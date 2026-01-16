import { readFile } from "fs/promises";

interface ZipEntry {
  name: string;
  compression: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const sig = 0x06054b50;
  for (let i = buffer.length - 22; i >= 0; i -= 1) {
    if (buffer.readUInt32LE(i) === sig) {
      return i;
    }
  }
  throw new Error("End of central directory not found");
}

function readCentralDirectory(buffer: Buffer): ZipEntry[] {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralOffset = buffer.readUInt32LE(eocdOffset + 16);
  let offset = centralOffset;
  const entries: ZipEntry[] = [];

  for (let i = 0; i < totalEntries; i += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("Central directory entry not found");
    }
    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    const name = buffer.slice(nameStart, nameEnd).toString("utf-8");
    entries.push({
      name,
      compression,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
    offset = nameEnd + extraLength + commentLength;
  }

  return entries;
}

function readEntryData(buffer: Buffer, entry: ZipEntry): Buffer {
  const localOffset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(localOffset) !== 0x04034b50) {
    throw new Error(`Local header not found for ${entry.name}`);
  }
  const compression = buffer.readUInt16LE(localOffset + 8);
  if (compression !== 0) {
    throw new Error(`Unsupported compression for ${entry.name}`);
  }
  const nameLength = buffer.readUInt16LE(localOffset + 26);
  const extraLength = buffer.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + nameLength + extraLength;
  return buffer.slice(dataStart, dataStart + entry.compressedSize);
}

export interface ZipFileEntry {
  name: string;
  data: Buffer;
}

export async function readZipEntries(zipPath: string): Promise<ZipFileEntry[]> {
  const data = await readFile(zipPath);
  const entries = readCentralDirectory(data);
  const files: ZipFileEntry[] = [];
  for (const entry of entries) {
    if (entry.name.endsWith("/")) continue;
    files.push({
      name: entry.name,
      data: readEntryData(data, entry),
    });
  }
  return files;
}
