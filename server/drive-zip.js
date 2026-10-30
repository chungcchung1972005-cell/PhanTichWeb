const {once}=require('events');
function crc32(buffer, crc=0xffffffff) {for(const byte of buffer){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return crc>>>0;}
// ZIP store, UTF-8 names and data descriptors allow bounded-memory streaming.
async function zip(res, entries) {
 let offset=0;const central=[];
 async function write(b){offset+=b.length;if(!res.write(b))await once(res,'drain');}
 for(const entry of entries){const name=Buffer.from(entry.name.replace(/[\\/\x00-\x1f]/g,'_'));const start=offset;let size=0,crc=0xffffffff;
 const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0x808,6);h.writeUInt16LE(name.length,26);await write(h);await write(name);
 for await(const chunk of await entry.open()){const b=Buffer.from(chunk);size+=b.length;if(size>0xffffffff)throw Error('zip_too_large');crc=crc32(b,crc);await write(b);}crc=(crc^0xffffffff)>>>0;
 const d=Buffer.alloc(16);d.writeUInt32LE(0x08074b50);d.writeUInt32LE(crc,4);d.writeUInt32LE(size,8);d.writeUInt32LE(size,12);await write(d);
 const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x808,8);c.writeUInt32LE(crc,16);c.writeUInt32LE(size,20);c.writeUInt32LE(size,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(start,42);central.push(c,name);
 }
 const start=offset;for(const b of central)await write(b);const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(offset-start,12);end.writeUInt32LE(start,16);await write(end);res.end();
}
module.exports={zip,crc32};
