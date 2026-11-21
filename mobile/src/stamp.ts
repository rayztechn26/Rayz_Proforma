import { toByteArray } from "base64-js";
const crcTable = Uint32Array.from({length:256},(_,index) => {
  let value=index;
  for(let bit=0;bit<8;bit++) value=(value>>>1)^((value&1)?0xedb88320:0);
  return value>>>0;
});

export function validStamp(value: string): boolean {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match || match[1]!.length > 14 * 1024 * 1024) return false;
  try {
    const bytes = toByteArray(match[1]!);
    if (bytes.length < 33 || bytes.length > 10 * 1024 * 1024) return false;
    if (![137,80,78,71,13,10,26,10].every((value,index) => bytes[index] === value)) return false;
    if (String.fromCharCode(...bytes.slice(12,16)) !== "IHDR") return false;
    const header = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    const width = header.getUint32(16), height = header.getUint32(20);
    if (!(width > 0 && height > 0 && width <= 4096 && height <= 4096)) return false;
    let offset=8, data=false;
    while(offset+12<=bytes.length) {
      const length=header.getUint32(offset);
      if(length>bytes.length-offset-12) return false;
      const type=String.fromCharCode(...bytes.slice(offset+4,offset+8));
      if(offset===8 && (type!=="IHDR" || length!==13)) return false;
      let crc=0xffffffff;
      for(let i=offset+4;i<offset+8+length;i++) crc=(crc>>>8)^crcTable[(crc^bytes[i]!)&255]!;
      if(((crc^0xffffffff)>>>0)!==header.getUint32(offset+8+length)) return false;
      if(type==="IDAT") data=true;
      if(type==="IEND") return data && length===0 && offset+12===bytes.length;
      offset+=length+12;
    }
    return false;
  } catch { return false; }
}
