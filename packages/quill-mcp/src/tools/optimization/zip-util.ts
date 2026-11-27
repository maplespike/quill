// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Minimal ZIP extraction for StatCan CSV downloads.
 *
 * StatCan's WDS export uses a *data descriptor*: the local file header has
 * bit 3 of the flags set and 0 for both compressed and uncompressed size, and
 * the real sizes only exist in the central directory. The previous version read
 * sizes from the local header, so it sliced a zero-byte payload, fed it to
 * DecompressionStream, and threw a TypeError with an empty message. The tool
 * reported that as `{"error":"TypeError"}` — `query_population` failed on every
 * single call (2026-11-27).
 *
 * Always take sizes from the central directory.
 */

const EOCD_SIG = 0x06054b50;
const CD_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

interface CentralEntry {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localOffset: number;
}

function findEndOfCentralDirectory(view: DataView): number {
  // The record is 22 bytes plus an optional up-to-64KiB comment; scan backwards.
  for (let i = view.byteLength - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) return i;
  }
  throw new Error('Not a valid ZIP file: no end-of-central-directory record');
}

function readCentralDirectory(view: DataView, buf: Uint8Array): CentralEntry[] {
  const eocd = findEndOfCentralDirectory(view);
  const totalEntries = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries: CentralEntry[] = [];
  const decoder = new TextDecoder();

  for (let i = 0; i < totalEntries && offset + 46 <= buf.length; i++) {
    if (view.getUint32(offset, true) !== CD_SIG) break;
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    entries.push({
      method: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      uncompressedSize: view.getUint32(offset + 24, true),
      localOffset: view.getUint32(offset + 42, true),
      name: decoder.decode(buf.slice(offset + 46, offset + 46 + nameLen)),
    });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream('deflate-raw');
  const writer = stream.writable.getWriter();
  void writer.write(data);
  void writer.close();
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const out = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let pos = 0;
  for (const chunk of chunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  return out;
}

export async function extractFromZip(zipBuf: ArrayBuffer): Promise<string> {
  const buf = new Uint8Array(zipBuf);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const entries = readCentralDirectory(view, buf);
  const entry = entries.find((candidate) => /\.csv$/i.test(candidate.name));
  if (!entry) {
    const names = entries.map((candidate) => candidate.name).join(', ') || 'none';
    throw new Error(`No CSV found in ZIP (entries: ${names})`);
  }
  if (entry.compressedSize === 0) {
    throw new Error(`ZIP entry ${entry.name} has a zero compressed size`);
  }

  const header = entry.localOffset;
  if (header + 30 > buf.length || view.getUint32(header, true) !== LOCAL_SIG) {
    throw new Error(`ZIP entry ${entry.name} has no local header at offset ${header}`);
  }
  const nameLen = view.getUint16(header + 26, true);
  const extraLen = view.getUint16(header + 28, true);
  const dataStart = header + 30 + nameLen + extraLen;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > buf.length) {
    throw new Error(`ZIP entry ${entry.name} claims ${entry.compressedSize} bytes but the archive ends early`);
  }

  const payload = buf.slice(dataStart, dataEnd);
  const raw = entry.method === 0 ? payload : await inflateRaw(payload);
  return new TextDecoder().decode(raw);
}
