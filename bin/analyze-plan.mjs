#!/usr/bin/env node
// Analyze a plan file: world-space bounding box per piece (using the same
// three.js Euler math as the app — position is the origin corner, rotation
// pivots around it), overall bounds, piece overlaps, and the stock purchase
// estimate from the cut-list packer.
//
// Usage: node bin/analyze-plan.mjs projects/some-plan.json
import { readFileSync } from 'fs';
import { Vector3, Euler } from 'three';
import { stockNeeded } from '../src/lib/stock.js';

const file = process.argv[2];
if (!file) {
  console.error('usage: node bin/analyze-plan.mjs <plan.json>');
  process.exit(1);
}
const plan = JSON.parse(readFileSync(file, 'utf8'));

const DEG = Math.PI / 180;
// Matches OVERLAP_TOLERANCE in Scene.svelte: pieces butted flush read as
// touching, not overlapping.
const TOL = 0.02;

function aabb(p) {
  const rot = new Euler(p.rx * DEG, p.ry * DEG, p.rz * DEG);
  const ax = new Vector3(p.w, 0, 0).applyEuler(rot);
  const ay = new Vector3(0, p.h, 0).applyEuler(rot);
  const az = new Vector3(0, 0, p.l).applyEuler(rot);
  const min = [p.x, p.y, p.z], max = [p.x, p.y, p.z];
  for (const [i, k] of [[0, 'x'], [1, 'y'], [2, 'z']]) {
    for (const a of [ax, ay, az]) {
      if (a[k] < 0) min[i] += a[k]; else max[i] += a[k];
    }
  }
  return { min, max };
}

// Print to the nearest 1/64" when exact, else 4 decimals.
const r = (v) => Math.abs(v - Math.round(v * 64) / 64) < 1e-6 ? Math.round(v * 64) / 64 : Number(v.toFixed(4));
const fmt = (b) => `x ${r(b.min[0])}..${r(b.max[0])}  y ${r(b.min[1])}..${r(b.max[1])}  z ${r(b.min[2])}..${r(b.max[2])}`;

const mats = Object.fromEntries(plan.materials.map((m) => [m.id, m.name]));
const boxes = plan.pieces.map((p) => ({ p, b: aabb(p) }));
boxes.sort((A, B) => A.b.min[1] - B.b.min[1] || A.b.min[0] - B.b.min[0] || A.b.min[2] - B.b.min[2]);

console.log(`# ${plan.name} — ${plan.pieces.length} pieces`);
for (const { p, b } of boxes) {
  const name = p.name ? ` "${p.name}"` : '';
  console.log(`  #${p.id}${name} [${mats[p.materialId]}] ${p.w}x${p.h}x${p.l} rot(${p.rx},${p.ry},${p.rz})  ${fmt(b)}`);
}

const overall = {
  min: [0, 1, 2].map((i) => Math.min(...boxes.map(({ b }) => b.min[i]))),
  max: [0, 1, 2].map((i) => Math.max(...boxes.map(({ b }) => b.max[i]))),
};
console.log(`OVERALL: ${fmt(overall)}  (W ${r(overall.max[0] - overall.min[0])} x H ${r(overall.max[1] - overall.min[1])} x D ${r(overall.max[2] - overall.min[2])})`);

// Note: axis-aligned check, exact only for pieces rotated in multiples of 90°
// (the common case); off-axis rotations may report false overlaps.
let overlaps = 0;
for (let i = 0; i < boxes.length; i++) {
  for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i].b, b = boxes[j].b;
    const pen = [0, 1, 2].map((k) => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]) - 2 * TOL);
    if (pen.every((v) => v > 0)) {
      overlaps++;
      console.log(`  OVERLAP #${boxes[i].p.id} vs #${boxes[j].p.id}: pen ${pen.map(r).join(' x ')}`);
    }
  }
}
console.log(overlaps ? `${overlaps} overlap(s)` : 'no overlaps');

console.log('STOCK:');
for (const m of plan.materials) {
  const n = stockNeeded(m, plan.pieces.filter((p) => p.materialId === m.id));
  if (!n) continue;
  const unplaced = n.unplaced ? `  (${n.unplaced} piece${n.unplaced > 1 ? 's' : ''} too big to cut!)` : '';
  console.log(`  ${m.name}: ${n.count} ${n.unit}${n.count > 1 ? 's' : ''}${unplaced}`);
}
