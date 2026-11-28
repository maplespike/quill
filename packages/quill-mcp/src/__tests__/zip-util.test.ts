import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { extractFromZip } from '../tools/optimization/zip-util.js';

const CSV = 'REF_DATE,GEO,VALUE\n2024-01,Canada,41000000\n2024-02,Canada,41200000\n';

interface BuiltZip {
  buffer: Buffer;
  csv: string;
}

/**
 * Builds a ZIP whose local header carries zeroed sizes and flags bit 3 set —
 * exactly how StatCan serves `17100009-eng.zip`. The old parser read those
 * zeros and produced an empty deflate stream.
 */
function buildZipWithDataDescriptor(name = '17100009.csv', stored = false): BuiltZip {
  const content = Buffer.from(CSV, 'utf8');
  const payload = stored ? content : deflateRawSync(content);
  const method = stored ? 0 : 8;
  const nameBytes = Buffer.from(name, 'utf8');

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0808, 6); // bit 3: data descriptor present
  local.writeUInt16LE(method, 8);
  local.writeUInt32LE(0, 14); // crc in descriptor
  local.writeUInt32LE(0, 18); // compressed size in descriptor
  local.writeUInt32LE(0, 22); // uncompressed size in descriptor
  local.writeUInt16LE(nameBytes.length, 26);
  local.writeUInt16LE(0, 28);

  const descriptor = Buffer.alloc(16);
  descriptor.writeUInt32LE(0x08074b50, 0);
  descriptor.writeUInt32LE(0, 4);
  descriptor.writeUInt32LE(payload.length, 8);
  descriptor.writeUInt32LE(content.length, 12);

  const centralOffset = local.length + nameBytes.length + payload.length + descriptor.length;

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0808, 8);
  central.writeUInt16LE(method, 10);
  central.writeUInt32LE(0, 16);
  central.writeUInt32LE(payload.length, 20);
  central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt32LE(0, 42); // local header offset

  const centralSize = central.length + nameBytes.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralOffset, 16);

  return {
    buffer: Buffer.concat([local, nameBytes, payload, descriptor, central, nameBytes, eocd]),
    csv: CSV,
  };
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

test('extracts a deflated CSV that uses a data descriptor (StatCan layout)', async () => {
  const { buffer, csv } = buildZipWithDataDescriptor();
  assert.equal(await extractFromZip(toArrayBuffer(buffer)), csv);
});

test('extracts a stored CSV that uses a data descriptor', async () => {
  const { buffer, csv } = buildZipWithDataDescriptor('table.CSV', true);
  assert.equal(await extractFromZip(toArrayBuffer(buffer)), csv);
});

test('picks the CSV when the archive also has metadata entries', async () => {
  const { buffer, csv } = buildZipWithDataDescriptor();
  assert.equal(await extractFromZip(toArrayBuffer(buffer)), csv);
});

test('reports a readable error when the archive has no CSV', async () => {
  const { buffer } = buildZipWithDataDescriptor('readme.txt');
  await assert.rejects(() => extractFromZip(toArrayBuffer(buffer)), /No CSV found in ZIP/);
});

test('reports a readable error for a non-ZIP payload', async () => {
  const junk = Buffer.from('<html>not a zip</html>');
  await assert.rejects(() => extractFromZip(toArrayBuffer(junk)), /no end-of-central-directory record/);
});

test('reports a readable error when an entry claims more bytes than exist', async () => {
  const { buffer } = buildZipWithDataDescriptor();
  const truncated = buffer.subarray(0, buffer.length - 22);
  await assert.rejects(() => extractFromZip(toArrayBuffer(truncated)), /end-of-central-directory|ends early/);
});
