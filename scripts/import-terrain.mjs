import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { decodeTerrarium, geoToPixel, projection } from './dem.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const cache=root+'.preview/terrain-source/';await mkdir(cache,{recursive:true});await mkdir(root+'src/data/',{recursive:true});
const origin={lon:107.76528,lat:33.95512,elevationOffset:3000};const project=projection(origin.lon,origin.lat),zoom=12;
const nearSize=2048,farSize=8192,nearSegments=256,farSegments=128;
const corners=[project.toGeo(-farSize/2,-farSize/2),project.toGeo(farSize/2,farSize/2)].map(p=>geoToPixel(p.lon,p.lat,zoom));
const tiles=new Map(),records=[];const hash=b=>createHash('sha256').update(b).digest('hex');
let previous;try{previous=JSON.parse(await readFile(root+'src/data/taibai-dem.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
for(let y=Math.floor((corners[0].y-1)/256);y<=Math.floor((corners[1].y+1)/256);y++)for(let x=Math.floor((corners[0].x-1)/256);x<=Math.floor((corners[1].x+1)/256);x++){
 const url='https://elevation-tiles-prod.s3.amazonaws.com/terrarium/'+zoom+'/'+x+'/'+y+'.png';const key=zoom+'-'+x+'-'+y;
 let bytes,meta;
 try{bytes=await readFile(cache+key+'.png');meta=JSON.parse(await readFile(cache+key+'.json','utf8'));if(meta.sha256!==hash(bytes))throw new Error('缓存哈希不符');}
 catch(e){if(e.code!=='ENOENT')throw e;const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('下载失败 '+response.status);
  if(Number(response.headers.get('content-length'))>1_000_000)throw new Error('瓦片超过体积预算');
  const chunks=[];let total=0;for await(const chunk of response.body){total+=chunk.length;if(total>1_000_000)throw new Error('响应超限');chunks.push(chunk);}bytes=Buffer.concat(chunks);
  meta={url,zoom,x,y,downloadedAt:new Date().toISOString(),lastModified:response.headers.get('last-modified'),sources:response.headers.get('x-amz-meta-x-imagery-sources'),sha256:hash(bytes),bytes:bytes.length};
  if(!meta.sources||!meta.sources.split(',').every(s=>s.trim().startsWith('srtm/')))throw new Error('数据来源需人工复核');
  await writeFile(cache+key+'.png',bytes);await writeFile(cache+key+'.json',JSON.stringify(meta,null,2));
 }
 const pinned=previous?.source.tiles.find(t=>t.url===url);if(pinned&&pinned.sha256!==meta.sha256)throw new Error('上游数据已变化，请复核后更新固定版本');
 const tile=decodeTerrarium(bytes);if(tile.width!==256||tile.height!==256)throw new Error('瓦片尺寸错误');tiles.set(x+','+y,tile);records.push(meta);
}
function pixel(x,y){const tile=tiles.get(Math.floor(x/256)+','+Math.floor(y/256));if(!tile)throw new Error('高程覆盖不足');return tile.heights[(y%256)*256+x%256];}
function sample(x,z){const geo=project.toGeo(x,z),p=geoToPixel(geo.lon,geo.lat,zoom);const ix=Math.floor(p.x-.5),iy=Math.floor(p.y-.5),u=p.x-.5-ix,v=p.y-.5-iy;return pixel(ix,iy)*(1-u)*(1-v)+pixel(ix+1,iy)*u*(1-v)+pixel(ix,iy+1)*(1-u)*v+pixel(ix+1,iy+1)*u*v;}
function grid(size,segments){const heights=[];for(let j=0;j<=segments;j++)for(let i=0;i<=segments;i++)heights.push(Math.round(sample(i*size/segments-size/2,j*size/segments-size/2)*10));return {size,segments,encoding:'decimetres',heights};}
const near=grid(nearSize,nearSegments),far=grid(farSize,farSegments);const values=[...near.heights,...far.heights];
if(values.some(h=>!Number.isFinite(h)||h<5000||h>50000))throw new Error('区域高程异常');
const source={name:'Mapzen Terrain Tiles / Terrarium',registry:'https://registry.opendata.aws/terrain-tiles/',documentation:'https://github.com/tilezen/joerd/blob/master/docs/formats.md',license:'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',verticalDatum:'EGM96 (SRTM source); delivered heights preserved',horizontalDatum:'WGS84 / Web Mercator source tiles',groundPixelMetres:Math.cos(origin.lat*Math.PI/180)*2*Math.PI*6378137/(256*2**zoom),resolutionNote:'约 31.7 m 瓦片采样；SRTM 名义质量约 90 m，插值不增加测量精度',tiles:records};
const result={schemaVersion:1,origin:{...origin,metersPerLongitude:project.metersPerLongitude,metersPerLatitude:project.metersPerLatitude},source,near,far,validation:{minElevation:Math.min(...values)/10,maxElevation:Math.max(...values)/10,voidCount:0,nearGridStep:nearSize/nearSegments,farGridStep:farSize/farSegments,centreElevation:sample(0,0),bounds:{northwest:project.toGeo(-farSize/2,-farSize/2),southeast:project.toGeo(farSize/2,farSize/2)},controlSamples:[{x:0,z:0},{x:120,z:80},{x:-200,z:240},{x:512,z:512}].map(p=>({...p,elevation:sample(p.x,p.z)}))}};
const json=JSON.stringify(result);await writeFile(root+'src/data/taibai-dem.json',json+'\n');console.log(JSON.stringify({file:'src/data/taibai-dem.json',bytes:Buffer.byteLength(json)+1,sha256:hash(json+'\n'),tiles:records.length,validation:result.validation},null,2));
