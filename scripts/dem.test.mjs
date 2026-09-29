import { expect, test } from 'vitest';
import { decodeTerrarium, geoToPixel, projection, bilinear } from './dem.mjs';
import { deflateSync, crc32 } from 'node:zlib';
function png(rgb, filter = 0) {
 const chunk=(name,data)=>{const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(name,4);data.copy(b,8);b.writeUInt32BE(crc32(b.subarray(4,8+data.length)),8+data.length);return b;};
 const header=Buffer.alloc(13);header.writeUInt32BE(1);header.writeUInt32BE(1,4);header[8]=8;header[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.from([filter,...rgb]))),chunk('IEND',Buffer.alloc(0))]);
}
test('Terrarium 大端 RGB 高程公式与五种 PNG 滤波首像素',()=>{
 for(let f=0;f<=4;f++){const p=decodeTerrarium(png([140,200,128],f));expect(p.width).toBe(1);expect(p.heights[0]).toBe(3272.5);}
});
test('拒绝非法图片和空高程，不把错误数据变成平地',()=>{
 expect(()=>decodeTerrarium(Buffer.alloc(20))).toThrow();expect(()=>decodeTerrarium(png([0,0,0]))).toThrow();expect(()=>decodeTerrarium(png([140,0,0],5))).toThrow();
});
test('WGS84 局部米制轴向与往返，纬度不会被当成 Z 正向',()=>{
 const p=projection(107.76528,33.95512);expect(p.toGeo(0,0)).toEqual({lon:107.76528,lat:33.95512});
 const a=p.toGeo(1000,-1000);expect(a.lon).toBeGreaterThan(107.76528);expect(a.lat).toBeGreaterThan(33.95512);
 expect(p.toWorld(a.lon,a.lat).x).toBeCloseTo(1000,7);expect(p.toWorld(a.lon,a.lat).z).toBeCloseTo(-1000,7);
 expect(geoToPixel(0,0,0)).toEqual({x:128,y:128});
});
test('双线性采样与边界',()=>{expect(bilinear([0,10,20,30],2,.5,.5)).toBe(15);expect(bilinear([0,10,20,30],2,1,1)).toBe(30);expect(()=>bilinear([0,10,20,30],2,2,1)).toThrow();});

test('校验损坏的 PNG 块',()=>{const bytes=png([140,200,128]);bytes[20]^=1;expect(()=>decodeTerrarium(bytes)).toThrow('CRC');});
test('多行 Sub / Up / Average / Paeth 还原与像素顺序',()=>{
 const width=3,height=3,channels=3,rawPixels=Buffer.from(Array.from({length:27},(_,i)=>i%3===0?140:30+i));
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 const chunk=(name,data)=>{const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(name,4);data.copy(b,8);b.writeUInt32BE(crc32(b.subarray(4,8+data.length)),8+data.length);return b;};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=2;
 for(let filter=0;filter<=4;filter++){
  const scan=[];for(let y=0;y<height;y++){scan.push(filter);for(let x=0;x<width*channels;x++){const i=y*9+x,a=x>=3?rawPixels[i-3]:0,b=y?rawPixels[i-9]:0,c=y&&x>=3?rawPixels[i-12]:0;scan.push((rawPixels[i]-[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter]+256)%256);}}
  const bytes=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(Buffer.from(scan))),chunk('IEND',Buffer.alloc(0))]);const result=decodeTerrarium(bytes);
  for(let i=0;i<9;i++)expect(result.heights[i]).toBe(rawPixels[i*3]*256+rawPixels[i*3+1]+rawPixels[i*3+2]/256-32768);
 }
});
