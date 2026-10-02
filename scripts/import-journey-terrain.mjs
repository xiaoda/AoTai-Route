import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { deflateSync, crc32 } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { decodeTerrarium, geoToPixel } from './dem.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const cache=root+'.preview/terrain-source/',output=root+'public/journey/';
await mkdir(cache,{recursive:true});await mkdir(output,{recursive:true});
const bounds={west:107.34,east:107.83,north:34.05,south:33.83};
const zoom=12, nw=geoToPixel(bounds.west,bounds.north,zoom),se=geoToPixel(bounds.east,bounds.south,zoom);
const hash=b=>createHash('sha256').update(b).digest('hex');
const records=[],tiles=new Map();
let previous;try{previous=JSON.parse(await readFile(output+'terrain.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
for(let y=Math.floor(nw.y/256);y<=Math.floor(se.y/256);y++)for(let x=Math.floor(nw.x/256);x<=Math.floor(se.x/256);x++){
 const key=zoom+'-'+x+'-'+y,url='https://elevation-tiles-prod.s3.amazonaws.com/terrarium/'+zoom+'/'+x+'/'+y+'.png';
 let bytes,meta;
 try{bytes=await readFile(cache+key+'.png');meta=JSON.parse(await readFile(cache+key+'.json','utf8'));if(hash(bytes)!==meta.sha256)throw Error('缓存哈希不符');}
 catch(e){if(e.code!=='ENOENT')throw e;const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('DEM HTTP '+response.status);
 const chunks=[];let total=0;for await(const chunk of response.body){total+=chunk.length;if(total>1000000)throw Error('瓦片体积超限');chunks.push(chunk);}bytes=Buffer.concat(chunks);
 meta={url,zoom,x,y,downloadedAt:new Date().toISOString(),lastModified:response.headers.get('last-modified'),sources:response.headers.get('x-amz-meta-x-imagery-sources'),sha256:hash(bytes),bytes:bytes.length};
 if(!meta.sources||!meta.sources.split(',').every(s=>s.trim().startsWith('srtm/')))throw Error('来源变化，需复核');
 decodeTerrarium(bytes);await writeFile(cache+key+'.png',bytes);await writeFile(cache+key+'.json',JSON.stringify(meta,null,2));}
 const pinned=previous?.source.tiles.find(t=>t.url===url);if(pinned&&pinned.sha256!==meta.sha256)throw Error('已固定的来源发生变化');
 const tile=decodeTerrarium(bytes);tiles.set(x+','+y,tile);records.push(meta);console.log(key+' verified');
}
function pixel(x,y){const tile=tiles.get(Math.floor(x/256)+','+Math.floor(y/256));if(!tile)throw Error('数据覆盖不足');return tile.heights[(y%256)*256+x%256];}
function sample(lon,lat){const p=geoToPixel(lon,lat,zoom),x=Math.floor(p.x-.5),y=Math.floor(p.y-.5),u=p.x-.5-x,v=p.y-.5-y;return pixel(x,y)*(1-u)*(1-v)+pixel(x+1,y)*u*(1-v)+pixel(x,y+1)*(1-u)*v+pixel(x+1,y+1)*u*v;}
const columns=481,rows=261,heights=[];
for(let j=0;j<rows;j++)for(let i=0;i<columns;i++)heights.push(Math.round(sample(bounds.west+i/(columns-1)*(bounds.east-bounds.west),bounds.north-j/(rows-1)*(bounds.north-bounds.south))));
if(heights.some(h=>!Number.isFinite(h)||h<0||h>4500))throw Error('区域高程异常');
const width=1600,height=867,metersX=111000*Math.cos(33.94*Math.PI/180)*(bounds.east-bounds.west)/(width-1),metersZ=111000*(bounds.north-bounds.south)/(height-1);
const imageHeights=new Float32Array(width*height);
for(let j=0;j<height;j++)for(let i=0;i<width;i++)imageHeights[j*width+i]=sample(bounds.west+i/(width-1)*(bounds.east-bounds.west),bounds.north-j/(height-1)*(bounds.north-bounds.south));
const raw=Buffer.alloc((width*3+1)*height);
const stops=[[1000,[115,137,118]],[2000,[157,170,136]],[2900,[191,193,155]],[3400,[215,207,176]],[3800,[233,225,203]]];
for(let j=0;j<height;j++)for(let i=0;i<width;i++){
 const index=j*width+i,h=imageHeights[index],dx=(imageHeights[j*width+Math.min(width-1,i+1)]-imageHeights[j*width+Math.max(0,i-1)])/(2*metersX),dz=(imageHeights[Math.min(height-1,j+1)*width+i]-imageHeights[Math.max(0,j-1)*width+i])/(2*metersZ);
 const normal=Math.sqrt(dx*dx+dz*dz+1),light=(-dx*-.55-dz*-.55+.63)/normal,shade=.65+.48*Math.max(0,light);
 let a=stops[0],b=stops.at(-1);for(let n=1;n<stops.length;n++)if(h<=stops[n][0]){a=stops[n-1];b=stops[n];break;}
 const t=Math.max(0,Math.min(1,(h-a[0])/(b[0]-a[0]))),contour=Math.min(h%100,100-h%100)<3?.965:1;
 for(let c=0;c<3;c++)raw[j*(width*3+1)+1+i*3+c]=Math.min(255,Math.round((a[1][c]*(1-t)+b[1][c]*t)*shade*contour));
}
function chunk(type,data){const t=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc]);}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=2;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
await writeFile(output+'relief.png',png);
const terrain={schemaVersion:1,bounds,columns,rows,heights,source:{name:'Mapzen Terrain Tiles / USGS SRTM',accessed:'2026-10-02',tiles:records,attribution:'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',note:'约 32 米原瓦片采样；本区域网格约 95 米。非精密测绘。设色与晕渲为原创表达，不是卫星影像。'},relief:{width,height,sha256:hash(png)}};
await writeFile(output+'terrain.json',JSON.stringify(terrain));console.log(JSON.stringify({tiles:records.length,heights:heights.length,pngBytes:png.length,jsonBytes:JSON.stringify(terrain).length,min:heights.reduce((a,b)=>Math.min(a,b),Infinity),max:heights.reduce((a,b)=>Math.max(a,b),-Infinity)}));
