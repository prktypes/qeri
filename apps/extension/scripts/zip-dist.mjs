#!/usr/bin/env node
/**
 * Package apps/extension/dist into a release zip for the Chrome Web Store —
 * exactly the payload the store review team receives (plan.md §Phase 7).
 * Zero-dependency: uses Node's fs to walk the tree and the `zip` availability is
 * abstracted through a tiny streaming writer to avoid platform-specific args.
 */
import { createWriteStream } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { crc32 } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(here, '..', 'dist');
const outPath = path.resolve(here, '..', 'qeri-extension.zip');

const files = [];
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else files.push(full);
  }
}
await walk(distDir);

/** Builds a minimal STORED-zip: FIFO order, deterministic content bytes. */
const chunks = [];
const central = [];
let offset = 0;

const now = new Date();
const dosTime =
  ((now.getHours() & 0x1f) << 11) |
  ((now.getMinutes() & 0x3f) << 5) |
  ((now.getSeconds() / 2) & 0x1f);
const dosDate =
  (((now.getFullYear() - 1980) & 0x7f) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

for (const file of files) {
  const rel = path.relative(distDir, file).split(path.sep).join('/');
  const bytes = await readFile(file);
  const crc = crc32(bytes) >>> 0;
  const name = Buffer.from(rel, 'utf8');

  // Local file header (stored, no compression for source maps alongside text assets)
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt16LE(0, 8); // stored
  local.writeUInt16LE(dosTime, 10);
  local.writeUInt16LE(dosDate, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(bytes.length, 18);
  local.writeUInt32LE(bytes.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);

  chunks.push(local, name, bytes);

  const centralEntry = Buffer.alloc(46);
  centralEntry.writeUInt32LE(0x02014b50, 0);
  centralEntry.writeUInt16LE(20, 4);
  centralEntry.writeUInt16LE(20, 6);
  centralEntry.writeUInt16LE(0x0800, 8);
  centralEntry.writeUInt16LE(0, 10);
  centralEntry.writeUInt16LE(dosTime, 12);
  centralEntry.writeUInt16LE(dosDate, 14);
  centralEntry.writeUInt32LE(crc, 16);
  centralEntry.writeUInt32LE(bytes.length, 20);
  centralEntry.writeUInt32LE(bytes.length, 24);
  centralEntry.writeUInt16LE(name.length, 28);
  centralEntry.writeUInt32LE(offset, 42);
  central.push(centralEntry, name);

  offset += local.length + name.length + bytes.length;
}

const centralOffset = offset;
const centralBuf = Buffer.concat(central);

const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(files.length, 8);
eocd.writeUInt16LE(files.length, 10);
eocd.writeUInt32LE(centralBuf.length, 12);
eocd.writeUInt32LE(centralOffset, 16);

const zip = Buffer.concat([...chunks, centralBuf, eocd]);
createWriteStream(outPath).end(zip, () => {
  console.log(`packaged ${files.length} files → ${outPath}`);
});
