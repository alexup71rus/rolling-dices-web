#!/usr/bin/env node
// scripts/generate-assets.mjs
// Generates dice face textures (PNG) and 3D models (GLB) for the dice game.
// Run: node scripts/generate-assets.mjs
//
// Requirements: Three.js must be installed (npm dependency).
// No external image/canvas libraries needed — PNGs are built from raw pixels.

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const texturesDir = join(root, 'public', 'textures');
const modelsDir = join(root, 'public', 'models');

mkdirSync(texturesDir, { recursive: true });
mkdirSync(modelsDir, { recursive: true });

// ========================= PNG Encoder =========================

function crc32(buf) {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, crcInput, crcBuf]);
}

function createPNG(width, height, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;   // bit depth
  ihdrData[9] = 6;   // RGBA
  ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0;
  const ihdr = createChunk('IHDR', ihdrData);

  const stride = 1 + width * 4; // filter byte + RGBA per pixel
  const raw = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // None filter
    pixels.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = createChunk('IDAT', deflateSync(raw));
  const iend = createChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

// ========================= Drawing Helpers =========================

function fillRect(pixels, W, H, x0, y0, w, h, color) {
  for (let y = Math.max(0, y0); y < Math.min(H, y0 + h); y++) {
    for (let x = Math.max(0, x0); x < Math.min(W, x0 + w); x++) {
      const i = (y * W + x) * 4;
      pixels[i] = color[0]; pixels[i+1] = color[1]; pixels[i+2] = color[2]; pixels[i+3] = color[3];
    }
  }
}

function fillCircle(pixels, W, cx, cy, r, color) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    if (y < 0 || y >= W) continue;
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (x < 0 || x >= W) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) {
        const i = (y * W + x) * 4;
        pixels[i] = color[0]; pixels[i+1] = color[1]; pixels[i+2] = color[2]; pixels[i+3] = color[3];
      }
    }
  }
}

// ========================= Face Texture Generation =========================

const SIZE = 256;
const PIP_R = 22;
const BG_COLOR = [249, 244, 236, 255]; // ivory
const PIP_COLOR = [35, 35, 40, 255];   // near-black

// Standard pip positions (centered in a 256×256 area, with margin ~60px)
const M = 70;  // margin from edge
const C = 128; // center
const PIP_LAYOUTS = {
  1: [[C, C]],
  2: [[SIZE - M, M], [M, SIZE - M]],
  3: [[SIZE - M, M], [C, C], [M, SIZE - M]],
  4: [[M, M], [SIZE - M, M], [M, SIZE - M], [SIZE - M, SIZE - M]],
  5: [[M, M], [SIZE - M, M], [C, C], [M, SIZE - M], [SIZE - M, SIZE - M]],
  6: [[M, M - 6], [SIZE - M, M - 6], [M, C], [SIZE - M, C], [M, SIZE - M + 6], [SIZE - M, SIZE - M + 6]],
};

for (let face = 1; face <= 6; face++) {
  const px = Buffer.alloc(SIZE * SIZE * 4);

  // Fill with ivory background
  for (let i = 0; i < SIZE * SIZE; i++) {
    px[i * 4]     = BG_COLOR[0];
    px[i * 4 + 1] = BG_COLOR[1];
    px[i * 4 + 2] = BG_COLOR[2];
    px[i * 4 + 3] = BG_COLOR[3];
  }

  // Draw pips
  for (const [cx, cy] of PIP_LAYOUTS[face]) {
    fillCircle(px, SIZE, cx, cy, PIP_R, PIP_COLOR);
  }

  const png = createPNG(SIZE, SIZE, px);
  const path = join(texturesDir, `face_${face}.png`);
  writeFileSync(path, png);
  console.log(`✓ ${path}`);
}

// ========================= GLB Generator =========================

// Constructs a valid GLB (Binary glTF 2.0) file from JSON + binary buffer.
function buildGLB(gltfJson, binBuffer) {
  const jsonStr = JSON.stringify(gltfJson);
  // Pad JSON to 4-byte alignment with spaces
  const jsonPad = (4 - (jsonStr.length % 4)) % 4;
  const jsonBuf = Buffer.from(jsonStr + ' '.repeat(jsonPad), 'utf-8');
  // Pad binary to 4-byte alignment with zeros
  const binPad = (4 - (binBuffer.length % 4)) % 4;
  const binBuf = Buffer.concat([binBuffer, Buffer.alloc(binPad)]);

  const totalLen = 12 + (8 + jsonBuf.length) + (8 + binBuf.length);
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'ascii');
  header.writeUInt32LE(2, 4);          // version
  header.writeUInt32LE(totalLen, 8);   // total length

  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(jsonBuf.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4E4F534A, 4); // "JSON"

  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(binBuf.length, 0);
  binChunkHeader.writeUInt32LE(0x004E4942, 4);  // "BIN\0"

  return Buffer.concat([header, jsonChunkHeader, jsonBuf, binChunkHeader, binBuf]);
}

// ========================= Dice Model (dice.glb) =========================
// A box 0.5×0.5×0.5 with 6 material groups (matching Three.js BoxGeometry group order).
// Group order (Three.js convention): +X, -X, +Y, -Y, +Z, -Z
// FACE_ORDER = [2, 5, 1, 6, 3, 4] maps these slots to face values.

function generateDiceGLB() {
  const S = 0.25; // half-side

  // 6 faces × 4 vertices = 24 vertices
  // Each face: position(3), normal(3), uv(2) = 8 floats × 4 bytes = 32 bytes per vertex
  // 6 faces × 6 indices = 36 indices (uint16)

  // Face definitions: vertices in CCW order so (v1-v0)×(v2-v0) = outward normal
  const faces = [
    // +X (slot 0, face value 2)
    { n: [1,0,0], verts: [[S,-S,-S],[S,S,-S],[S,S,S],[S,-S,S]], uvs: [[0,0],[0,1],[1,1],[1,0]] },
    // -X (slot 1, face value 5)
    { n: [-1,0,0], verts: [[-S,-S,S],[-S,S,S],[-S,S,-S],[-S,-S,-S]], uvs: [[0,0],[0,1],[1,1],[1,0]] },
    // +Y (slot 2, face value 1)
    { n: [0,1,0], verts: [[-S,S,S],[S,S,S],[S,S,-S],[-S,S,-S]], uvs: [[0,0],[1,0],[1,1],[0,1]] },
    // -Y (slot 3, face value 6)
    { n: [0,-1,0], verts: [[-S,-S,-S],[S,-S,-S],[S,-S,S],[-S,-S,S]], uvs: [[0,0],[1,0],[1,1],[0,1]] },
    // +Z (slot 4, face value 3)
    { n: [0,0,1], verts: [[-S,-S,S],[S,-S,S],[S,S,S],[-S,S,S]], uvs: [[0,0],[1,0],[1,1],[0,1]] },
    // -Z (slot 5, face value 4)
    { n: [0,0,-1], verts: [[S,-S,-S],[-S,-S,-S],[-S,S,-S],[S,S,-S]], uvs: [[0,0],[1,0],[1,1],[0,1]] },
  ];

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let f = 0; f < 6; f++) {
    const base = f * 4;
    const face = faces[f];
    for (let v = 0; v < 4; v++) {
      positions.push(...face.verts[v]);
      normals.push(...face.n);
      uvs.push(...face.uvs[v]);
    }
    // Two triangles per face
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  // Build binary buffer
  const posArr = new Float32Array(positions);
  const normArr = new Float32Array(normals);
  const uvArr = new Float32Array(uvs);
  const idxArr = new Uint16Array(indices);

  const posBuf = Buffer.from(posArr.buffer);
  const normBuf = Buffer.from(normArr.buffer);
  const uvBuf = Buffer.from(uvArr.buffer);
  const idxBuf = Buffer.from(idxArr.buffer);

  // Ensure 4-byte alignment for each accessor's data
  const pad = (len) => (4 - (len % 4)) % 4;
  const idxPad = Buffer.alloc(pad(idxBuf.length));

  const binBuffer = Buffer.concat([posBuf, normBuf, uvBuf, idxBuf, idxPad]);

  const posOffset = 0;
  const normOffset = posBuf.length;
  const uvOffset = normOffset + normBuf.length;
  const idxOffset = uvOffset + uvBuf.length;

  // Compute bounding box
  const min = [S, S, S];
  const max = [-S, -S, -S];
  for (let i = 0; i < positions.length; i += 3) {
    for (let j = 0; j < 3; j++) {
      if (positions[i+j] < min[j]) min[j] = positions[i+j];
      if (positions[i+j] > max[j]) max[j] = positions[i+j];
    }
  }

  const gltf = {
    asset: { version: "2.0", generator: "dice-asset-gen" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{
      primitives: [{
        attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
        indices: 3,
        material: 0,
      }],
    }],
    materials: [
      { pbrMetallicRoughness: { baseColorFactor: [0.95, 0.93, 0.88, 1], metallicFactor: 0, roughnessFactor: 0.6 }, name: "dice" },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 24, type: "VEC3", max: max, min: min },
      { bufferView: 1, componentType: 5126, count: 24, type: "VEC3" },
      { bufferView: 2, componentType: 5126, count: 24, type: "VEC2" },
      { bufferView: 3, componentType: 5123, count: 36, type: "SCALAR" },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: posOffset, byteLength: posBuf.length, target: 34962 },
      { buffer: 0, byteOffset: normOffset, byteLength: normBuf.length, target: 34962 },
      { buffer: 0, byteOffset: uvOffset, byteLength: uvBuf.length, target: 34962 },
      { buffer: 0, byteOffset: idxOffset, byteLength: idxBuf.length + idxPad.length, target: 34963 },
    ],
    buffers: [{ byteLength: binBuffer.length }],
  };

  return buildGLB(gltf, binBuffer);
}

// ========================= Board Model (board.glb) =========================
// A shallow tray: flat 13×13 surface with low raised edges (height 0.6, thickness 0.3).

function generateBoardGLB() {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  let vCount = 0;

  function addQuad(v0, v1, v2, v3, n, uv0, uv1, uv2, uv3) {
    const base = vCount;
    positions.push(...v0, ...v1, ...v2, ...v3);
    normals.push(...n, ...n, ...n, ...n);
    uvs.push(...uv0, ...uv1, ...uv2, ...uv3);
    indices.push(base, base+1, base+2, base, base+2, base+3);
    vCount += 4;
  }

  const W = 6.5;  // half-width
  const EH = 0.6; // edge height
  const ET = 0.3; // edge thickness

  // Floor (top face) — CCW winding so normal points +Y
  addQuad(
    [-W, 0, -W], [-W, 0, W], [W, 0, W], [W, 0, -W],
    [0, 1, 0],
    [0, 0], [0, 1], [1, 1], [1, 0],
  );

  // 4 wall segments: inner face + top
  const wallDefs = [
    // Front wall (-Z): from (-W, 0, -W) to (W, EH, -W+ET)
    { inner: [[-W,0,-W+ET],[W,0,-W+ET],[W,EH,-W+ET],[-W,EH,-W+ET]], n_inner: [0,0,1],
      top: [[-W,EH,-W+ET],[W,EH,-W+ET],[W,EH,-W],[-W,EH,-W]], n_top: [0,1,0] },
    // Back wall (+Z)
    { inner: [[W,0,W-ET],[-W,0,W-ET],[-W,EH,W-ET],[W,EH,W-ET]], n_inner: [0,0,-1],
      top: [[W,EH,W-ET],[-W,EH,W-ET],[-W,EH,W],[W,EH,W]], n_top: [0,1,0] },
    // Left wall (-X)
    { inner: [[-W+ET,0,W],[-W+ET,0,-W],[-W+ET,EH,-W],[-W+ET,EH,W]], n_inner: [1,0,0],
      top: [[-W+ET,EH,W],[-W+ET,EH,-W],[-W,EH,-W],[-W,EH,W]], n_top: [0,1,0] },
    // Right wall (+X)
    { inner: [[W-ET,0,-W],[W-ET,0,W],[W-ET,EH,W],[W-ET,EH,-W]], n_inner: [-1,0,0],
      top: [[W-ET,EH,-W],[W-ET,EH,W],[W,EH,W],[W,EH,-W]], n_top: [0,1,0] },
  ];

  for (const w of wallDefs) {
    addQuad(w.inner[0], w.inner[1], w.inner[2], w.inner[3], w.n_inner, [0,0],[1,0],[1,1],[0,1]);
    addQuad(w.top[0], w.top[1], w.top[2], w.top[3], w.n_top, [0,0],[1,0],[1,1],[0,1]);
  }

  // Build binary
  const posArr = new Float32Array(positions);
  const normArr = new Float32Array(normals);
  const uvArr = new Float32Array(uvs);
  const idxArr = new Uint16Array(indices);

  const posBuf = Buffer.from(posArr.buffer);
  const normBuf = Buffer.from(normArr.buffer);
  const uvBuf = Buffer.from(uvArr.buffer);
  const idxBuf = Buffer.from(idxArr.buffer);
  const pad = (len) => Buffer.alloc((4 - (len % 4)) % 4);

  const binBuffer = Buffer.concat([posBuf, normBuf, uvBuf, idxBuf, pad(idxBuf.length)]);

  // Bounding box
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let j = 0; j < 3; j++) {
      if (positions[i+j] < min[j]) min[j] = positions[i+j];
      if (positions[i+j] > max[j]) max[j] = positions[i+j];
    }
  }

  const gltf = {
    asset: { version: "2.0", generator: "dice-asset-gen" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{
      primitives: [{
        attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
        indices: 3,
        material: 0,
      }],
    }],
    materials: [{
      pbrMetallicRoughness: {
        baseColorFactor: [0.35, 0.17, 0.05, 1], // dark wood
        metallicFactor: 0,
        roughnessFactor: 0.9,
      },
      name: "board_wood",
    }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: vCount, type: "VEC3", max, min },
      { bufferView: 1, componentType: 5126, count: vCount, type: "VEC3" },
      { bufferView: 2, componentType: 5126, count: vCount, type: "VEC2" },
      { bufferView: 3, componentType: 5123, count: indices.length, type: "SCALAR" },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posBuf.length, target: 34962 },
      { buffer: 0, byteOffset: posBuf.length, byteLength: normBuf.length, target: 34962 },
      { buffer: 0, byteOffset: posBuf.length + normBuf.length, byteLength: uvBuf.length, target: 34962 },
      { buffer: 0, byteOffset: posBuf.length + normBuf.length + uvBuf.length, byteLength: idxBuf.length + pad(idxBuf.length).length, target: 34963 },
    ],
    buffers: [{ byteLength: binBuffer.length }],
  };

  return buildGLB(gltf, binBuffer);
}

// ========================= Generate =========================

const diceGlb = generateDiceGLB();
writeFileSync(join(modelsDir, 'dice.glb'), diceGlb);
console.log(`✓ ${join(modelsDir, 'dice.glb')} (${diceGlb.length} bytes)`);

const boardGlb = generateBoardGLB();
writeFileSync(join(modelsDir, 'board.glb'), boardGlb);
console.log(`✓ ${join(modelsDir, 'board.glb')} (${boardGlb.length} bytes)`);

console.log('\nAll assets generated successfully.');
