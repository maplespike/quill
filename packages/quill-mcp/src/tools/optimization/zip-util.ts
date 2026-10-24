// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Minimal ZIP extraction for StatCan CSV downloads.
 * Extracts the first CSV file from a ZIP buffer.
 */
export async function extractFromZip(zipBuf: ArrayBuffer): Promise<string> {
  const buf = new Uint8Array(zipBuf);
  const view = new DataView(buf.buffer);

  // Find central directory signature at end of file
  let end = buf.length - 22;
  while (end > 0) {
    if (view.getUint32(end, true) === 0x06054b50) break; // End of central directory
    end--;
  }
  if (end <= 0) throw new Error('Not a valid ZIP file');

  // Parse local file header to find the first stored/compressed file
  let offset = 0;
  while (offset < buf.length) {
    if (view.getUint32(offset, true) !== 0x04034b50) break; // Local file header signature
    const compression = view.getUint16(offset + 8, true);
    const compSize = view.getUint32(offset + 18, true);
    const uncompSize = view.getUint32(offset + 22, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const fileName = new TextDecoder().decode(buf.slice(offset + 30, offset + 30 + nameLen));

    const dataStart = offset + 30 + nameLen + extraLen;

    if (fileName.endsWith('.csv') || fileName.endsWith('.CSV')) {
      if (compression === 0) {
        // Stored (uncompressed)
        return new TextDecoder().decode(buf.slice(dataStart, dataStart + uncompSize));
      }
      if (compression === 8) {
        // Deflated — use DecompressionStream
        const stream = new DecompressionStream('deflate-raw');
        const writer = stream.writable.getWriter();
        writer.write(buf.slice(dataStart, dataStart + compSize));
        writer.close();
        const reader = stream.readable.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const totalLen = chunks.reduce((s, c) => s + c.length, 0);
        const combined = new Uint8Array(totalLen);
        let pos = 0;
        for (const chunk of chunks) { combined.set(chunk, pos); pos += chunk.length; }
        return new TextDecoder().decode(combined);
      }
    }
    offset = dataStart + (compression === 0 ? uncompSize : compSize);
  }
  throw new Error('No CSV found in ZIP');
}
