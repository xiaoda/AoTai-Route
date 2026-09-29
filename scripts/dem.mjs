import { inflateSync, crc32 } from 'node:zlib';

/** 仅支持公开 Terrarium 使用的 8-bit RGB/RGBA、非交错 PNG；绝不执行图片附带内容。 */
export function decodeTerrarium(bytes) {
 if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('无效 PNG');
 let width=0,height=0,channels=0,ended=false;const parts=[];
 for(let offset=8;offset+12<=bytes.length;){
  const length=bytes.readUInt32BE(offset), type=bytes.toString('ascii',offset+4,offset+8);
  if(length>2_000_000 || offset+length+12>bytes.length)throw new Error('PNG 块损坏');
  const data=bytes.subarray(offset+8,offset+8+length);
  if(crc32(bytes.subarray(offset+4,offset+8+length))!==bytes.readUInt32BE(offset+8+length))throw new Error('PNG CRC 校验失败');
  if(type==='IHDR'){
   if(length!==13 || width)throw new Error('IHDR 无效');width=data.readUInt32BE(0);height=data.readUInt32BE(4);
   if(width<1||height<1||width>512||height>512||data[8]!==8||![2,6].includes(data[9])||data[10]||data[11]||data[12])throw new Error('不支持的 PNG 格式');
   channels=data[9]===2?3:4;
  }else if(type==='IDAT')parts.push(data);else if(type==='IEND'){ended=true;break;}
  offset+=length+12;
 }
 if(!ended||!width||!parts.length)throw new Error('PNG 不完整');
 const stride=width*channels, raw=inflateSync(Buffer.concat(parts),{maxOutputLength:(stride+1)*height});
 if(raw.length!==(stride+1)*height)throw new Error('PNG 长度不符');
 const decoded=Buffer.alloc(stride*height);
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<height;y++){
  const filter=raw[y*(stride+1)];if(filter>4)throw new Error('PNG 滤波未知');
  for(let x=0;x<stride;x++){
   const i=y*stride+x,a=x>=channels?decoded[i-channels]:0,b=y?decoded[i-stride]:0,c=y&&x>=channels?decoded[i-stride-channels]:0;
   const predictor=[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter];decoded[i]=(raw[y*(stride+1)+1+x]+predictor)&255;
  }
 }
 const heights=new Float32Array(width*height);
 for(let i=0;i<heights.length;i++){
  const n=i*channels,h=decoded[n]*256+decoded[n+1]+decoded[n+2]/256-32768;
  if(h<-12000||h>9000||(channels===4&&decoded[n+3]!==255))throw new Error('空值或无效高程');heights[i]=h;
 }
 return {width,height,heights};
}
export function geoToPixel(lon,lat,zoom){
 if(!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lon)>180||Math.abs(lat)>85||!Number.isInteger(zoom)||zoom<0||zoom>20)throw new Error('坐标无效');
 const scale=256*2**zoom;return {x:(lon+180)/360*scale,y:(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*scale};
}
/** WGS84 原点处经纬度曲率半径，局部东-上-南坐标，米制且不夸大高度。 */
export function projection(lon,lat){
 const phi=lat*Math.PI/180,e2=6.69437999014e-3,a=6378137,d=Math.sqrt(1-e2*Math.sin(phi)**2);
 const metersPerLongitude=Math.PI/180*a/d*Math.cos(phi),metersPerLatitude=Math.PI/180*a*(1-e2)/d**3;
 return {metersPerLongitude,metersPerLatitude,toGeo:(x,z)=>({lon:lon+x/metersPerLongitude,lat:lat-z/metersPerLatitude}),toWorld:(lng,phi)=>({x:(lng-lon)*metersPerLongitude,z:(lat-phi)*metersPerLatitude})};
}
export function bilinear(values,width,x,y){
 const height=values.length/width;if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>width-1||y>height-1)throw new Error('采样越界');
 const i=Math.min(width-2,Math.floor(x)),j=Math.min(height-2,Math.floor(y)),u=x-i,v=y-j;
 const a=values[j*width+i],b=values[j*width+i+1],c=values[(j+1)*width+i],d=values[(j+1)*width+i+1];
 return a*(1-u)*(1-v)+b*u*(1-v)+c*(1-u)*v+d*u*v;
}
