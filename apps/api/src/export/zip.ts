import { createHash } from "crypto";
import { open, readFile } from "fs/promises";
import path from "path";

const ZIP_VERSION = 20;
const DOS_TIME = 0;
const DOS_DATE = 33;

function toPosix(value: string) {
  return value.replace(/\\/g, "/");
}

function crc32(data: Buffer): number {
  let crc = 0 ^ -1;
  for (let i = 0; i < data.length; i += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function buildLocalHeader(nameBytes: Buffer, entry: ZipEntry): Buffer {
  const header = Buffer.alloc(30 + nameBytes.length);
  let offset = 0;
  header.writeUInt32LE(0x04034b50, offset); offset += 4;
  header.writeUInt16LE(ZIP_VERSION, offset); offset += 2;
  header.writeUInt16LE(0, offset); offset += 2;
  header.writeUInt16LE(0, offset); offset += 2;
  header.writeUInt16LE(DOS_TIME, offset); offset += 2;
  header.writeUInt16LE(DOS_DATE, offset); offset += 2;
  header.writeUInt32LE(entry.crc32, offset); offset += 4;
  header.writeUInt32LE(entry.size, offset); offset += 4;
  header.writeUInt32LE(entry.size, offset); offset += 4;
  header.writeUInt16LE(nameBytes.length, offset); offset += 2;
  header.writeUInt16LE(0, offset); offset += 2;
  nameBytes.copy(header, offset);
  return header;
}

function buildCentralHeader(nameBytes: Buffer, entry: ZipEntry): Buffer {
  const header = Buffer.alloc(46 + nameBytes.length);
  let offset = 0;
  header.writeUInt32LE(0x02014b50, offset); offset += 4;
  header.writeUInt16LE(ZIP_VERSION, offset); offset += 2;
  header.writeUInt16LE(ZIP_VERSION, offset); offset += 2;
  header.writeUInt16LE(0, offset); offset += 2;
  header.writeUInt16LE(0, offset); offset += 2;
  header.writeUInt16LE(DOS_TIME, offset); offset += 2;
  header.writeUInt16LE(DOS_DATE, offset); offset += 2;
  header.writeUInt32LE(entry.crc32, offset); offset += 4;
  header.writeUInt32LE(entry.size, offset); offset += 4;
  header.writeUInt32LE(entry.size, offset); offset += 4;
  header.writeUInt16LE(nameBytes.length, offset); offset += 2;
  header.writeUInt16LE(0, offset); offset += 2;
  header.writeUInt16LE(0, offset); offset += 2;
  header.writeUInt16LE(0, offset); offset += 2;
  header.writeUInt16LE(0, offset); offset += 2;
  header.writeUInt32LE(0, offset); offset += 4;
  header.writeUInt32LE(entry.offset, offset); offset += 4;
  nameBytes.copy(header, offset);
  return header;
}

function buildEndRecord(totalEntries: number, size: number, offset: number): Buffer {
  const header = Buffer.alloc(22);
  let pos = 0;
  header.writeUInt32LE(0x06054b50, pos); pos += 4;
  header.writeUInt16LE(0, pos); pos += 2;
  header.writeUInt16LE(0, pos); pos += 2;
  header.writeUInt16LE(totalEntries, pos); pos += 2;
  header.writeUInt16LE(totalEntries, pos); pos += 2;
  header.writeUInt32LE(size, pos); pos += 4;
  header.writeUInt32LE(offset, pos); pos += 4;
  header.writeUInt16LE(0, pos);
  return header;
}

interface ZipEntry {
  name: string;
  size: number;
  crc32: number;
  offset: number;
}

export async function createDeterministicZip(
  outputPath: string,
  rootDir: string,
  files: string[]
): Promise<void> {
  const handle = await open(outputPath, "w");
  let offset = 0;
  const entries: ZipEntry[] = [];
  const sorted = [...files].sort();

  for (const file of sorted) {
    const normalized = toPosix(file);
    const nameBytes = Buffer.from(normalized, "utf-8");
    const fullPath = path.join(rootDir, file);
    const data = await readFile(fullPath);
    const crc = crc32(data);
    const entry: ZipEntry = {
      name: normalized,
      size: data.length,
      crc32: crc,
      offset,
    };
    const localHeader = buildLocalHeader(nameBytes, entry);
    await handle.write(localHeader, 0, localHeader.length, offset);
    offset += localHeader.length;
    await handle.write(data, 0, data.length, offset);
    offset += data.length;
    entries.push(entry);
  }

  const centralOffset = offset;
  const centralBuffers = entries.map((entry) => {
    const nameBytes = Buffer.from(entry.name, "utf-8");
    return buildCentralHeader(nameBytes, entry);
  });
  for (const buffer of centralBuffers) {
    await handle.write(buffer, 0, buffer.length, offset);
    offset += buffer.length;
  }
  const centralSize = offset - centralOffset;
  const endRecord = buildEndRecord(entries.length, centralSize, centralOffset);
  await handle.write(endRecord, 0, endRecord.length, offset);
  await handle.close();
}

export async function hashZip(filePath: string): Promise<string> {
  const data = await readFile(filePath);
  return createHash("sha256").update(data).digest("hex");
}
