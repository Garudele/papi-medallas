#!/usr/bin/env node
// Encripta data/plaintext.json y assets/plaintext-fotos/dia-XX.jpg|png
// con AES-GCM 256 + PBKDF2 SHA-256 (100k iters).
//
// Uso:   node scripts/encrypt.mjs "tu-password"
// Salida: data/encrypted.json  +  assets/fotos/dia-XX.bin

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const password = process.argv[2];
if (!password) {
  console.error('Uso: node scripts/encrypt.mjs "tu-password"');
  process.exit(1);
}

const PBKDF2_ITER = 100000;
const enc = new TextEncoder();

async function deriveKey(password, salt) {
  const baseKey = await webcrypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return webcrypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITER, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, ['encrypt']
  );
}

async function encryptBytes(key, data) {
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ct = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { iv, ct: new Uint8Array(ct) };
}

const b64 = (u8) => Buffer.from(u8).toString('base64');

const salt = webcrypto.getRandomValues(new Uint8Array(16));
const key = await deriveKey(password, salt);

// --- Encrypt messages ---
const plainPath = path.join(root, 'data/plaintext.json');
if (!existsSync(plainPath)) {
  console.error('Falta data/plaintext.json');
  process.exit(1);
}
const plain = await readFile(plainPath);
const { iv, ct } = await encryptBytes(key, plain);
await writeFile(
  path.join(root, 'data/encrypted.json'),
  JSON.stringify({ v: 1, salt: b64(salt), iv: b64(iv), ciphertext: b64(ct) }, null, 2)
);
console.log('✓ data/encrypted.json');

// --- Encrypt photos ---
const photosDir = path.join(root, 'assets/plaintext-fotos');
const outDir = path.join(root, 'assets/fotos');
if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });

if (existsSync(photosDir)) {
  const files = (await readdir(photosDir))
    .filter((f) => /^dia-\d+\.(jpg|jpeg|png)$/i.test(f))
    .sort();
  if (files.length === 0) {
    console.log('(no hay fotos en assets/plaintext-fotos/)');
  }
  for (const f of files) {
    const buf = await readFile(path.join(photosDir, f));
    const { iv: pIv, ct: pCt } = await encryptBytes(key, buf);
    const out = f.replace(/\.(jpg|jpeg|png)$/i, '.bin');
    await writeFile(path.join(outDir, out), Buffer.concat([Buffer.from(pIv), Buffer.from(pCt)]));
    console.log(`✓ assets/fotos/${out}`);
  }
} else {
  console.log('(crea assets/plaintext-fotos/ y mete dia-21.jpg ... dia-30.jpg)');
}

console.log('\n✅ Listo. Ahora:\n  git add -A && git commit -m "update content" && git push');
