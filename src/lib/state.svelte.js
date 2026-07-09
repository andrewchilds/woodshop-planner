import { Vector3, Euler } from 'three';

// All dimensions and positions are stored in inches. Piece dims map to axes as
// w → x, h → y, l → z. A piece's position is its origin corner (the minimum
// corner when unrotated); rotation pivots around that corner.
const STORAGE_KEY = 'woodshop-planner-v1';
const PROJECTS_KEY = 'woodshop-planner-projects';
const FORMAT_VERSION = 3;
const DEG = Math.PI / 180;

function defaults() {
  return {
    name: 'Untitled',
    units: 'imperial', // 'imperial' | 'metric'
    snap: true,
    materials: [
      { id: 1, name: '2x4', w: 3.5, h: 1.5, l: 96, color: '#d9a765', fixed: ['w', 'h'] },
      { id: 2, name: '2x6', w: 5.5, h: 1.5, l: 96, color: '#c98f4e', fixed: ['w', 'h'] },
      { id: 3, name: '3/4" plywood', w: 48, h: 0.75, l: 96, color: '#e8cf9e', fixed: ['h'] },
      { id: 4, name: '1x4', w: 3.5, h: 0.75, l: 72, color: '#b97d45', fixed: ['w', 'h'] },
    ],
    pieces: [],
    selectedId: null,
    view: 'solid', // 'solid' | 'xray' — display-only, not serialized
    cutListGrouped: true, // cut list grouped by size — display-only, not serialized
    hiddenIds: [], // pieces hidden in the 3D view — display-only, not serialized
    cutDiagramId: null, // material whose cut diagram is open — display-only, not serialized
  };
}

// v1 stored piece positions as the box center; convert to corner origin.
// v2 materials had no fixed dims; guess sheet goods by width, lumber otherwise.
function migrate(data) {
  const v = data.version ?? 1;
  if (v < 2 && data.pieces) {
    for (const p of data.pieces) {
      const half = new Vector3(p.w / 2, p.h / 2, p.l / 2).applyEuler(
        new Euler(p.rx * DEG, p.ry * DEG, p.rz * DEG)
      );
      p.x -= half.x;
      p.y -= half.y;
      p.z -= half.z;
    }
  }
  if (v < 3 && data.materials) {
    for (const m of data.materials) {
      m.fixed ??= m.w >= 12 ? ['h'] : ['w', 'h'];
    }
  }
  return data;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...defaults(), ...migrate(JSON.parse(raw)), selectedId: null };
    }
  } catch (err) {
    console.warn('Ignoring corrupt saved plan', err);
  }
  return defaults();
}

export const plan = $state(load());

let nextId = 1;
refreshNextId();

function refreshNextId() {
  nextId =
    Math.max(0, ...plan.materials.map((m) => m.id), ...plan.pieces.map((p) => p.id)) + 1;
}

export function serialize() {
  const { name, units, snap, materials, pieces } = plan;
  return JSON.stringify({ version: FORMAT_VERSION, name, units, snap, materials, pieces });
}

export function persist(json) {
  localStorage.setItem(STORAGE_KEY, json);
}

// Replace the whole current plan (used by named-project load and file import).
function applyData(data) {
  const d = { ...defaults(), ...migrate(data) };
  plan.name = d.name;
  plan.units = d.units;
  plan.snap = d.snap;
  plan.materials = d.materials;
  plan.pieces = d.pieces;
  plan.selectedId = null;
  plan.hiddenIds = [];
  refreshNextId();
}

// --- Undo/redo ---
// History entries are full serialized snapshots. Recording is driven by the
// debounced autosave effect in App.svelte, so a continuous gesture (e.g. a
// drag) collapses into a single undo step.

const HISTORY_LIMIT = 100;
const undoStack = [];
const redoStack = [];
let snapshot = serialize(); // the last recorded state

export const history = $state({ canUndo: false, canRedo: false });

function syncHistory() {
  history.canUndo = undoStack.length > 0;
  history.canRedo = redoStack.length > 0;
}

export function recordHistory(json = serialize()) {
  if (json === snapshot) return;
  undoStack.push(snapshot);
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack.length = 0;
  snapshot = json;
  syncHistory();
}

function applySnapshot(json) {
  const d = JSON.parse(json);
  plan.name = d.name;
  plan.units = d.units;
  plan.snap = d.snap;
  plan.materials = d.materials;
  plan.pieces = d.pieces;
  if (plan.selectedId != null && !plan.pieces.some((p) => p.id === plan.selectedId)) {
    plan.selectedId = null;
  }
  plan.hiddenIds = plan.hiddenIds.filter((id) => plan.pieces.some((p) => p.id === id));
  refreshNextId();
}

export function undo() {
  recordHistory(); // capture any change still waiting on the debounce
  if (!undoStack.length) return;
  redoStack.push(snapshot);
  snapshot = undoStack.pop();
  applySnapshot(snapshot);
  syncHistory();
}

export function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot);
  snapshot = redoStack.pop();
  applySnapshot(snapshot);
  syncHistory();
}

// --- Named projects in localStorage ---

function readProjects() {
  try {
    return JSON.parse(localStorage.getItem(PROJECTS_KEY)) ?? {};
  } catch {
    return {};
  }
}

export const projectStore = $state({ names: Object.keys(readProjects()).sort() });

export function saveProject() {
  if (!plan.name.trim()) plan.name = 'Untitled';
  const all = readProjects();
  all[plan.name.trim()] = JSON.parse(serialize());
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(all));
  projectStore.names = Object.keys(all).sort();
}

export function loadProject(name) {
  const data = readProjects()[name];
  if (data) applyData(data);
}

export function deleteProject(name) {
  const all = readProjects();
  delete all[name];
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(all));
  projectStore.names = Object.keys(all).sort();
}

// --- Plain-text file import/export ---

export function exportText() {
  return JSON.stringify(JSON.parse(serialize()), null, 2);
}

export function importText(text) {
  const data = JSON.parse(text);
  if (!Array.isArray(data.materials) || !Array.isArray(data.pieces)) {
    throw new Error('not a woodshop plan file');
  }
  applyData(data);
}

export function materialById(id) {
  return plan.materials.find((m) => m.id === id);
}

// Dimension keys ('w' | 'h' | 'l') locked to the material's stock size.
export function fixedDims(materialId) {
  return new Set(materialById(materialId)?.fixed ?? []);
}

export function pieceById(id) {
  return plan.pieces.find((p) => p.id === id);
}

export function selectedPiece() {
  return plan.selectedId == null ? null : (pieceById(plan.selectedId) ?? null);
}

export function addMaterial(fields) {
  plan.materials.push({ id: nextId++, ...fields });
}

export function updateMaterial(id, fields) {
  const m = materialById(id);
  if (!m) return;
  Object.assign(m, fields);
  // Fixed dims are locked to stock size, so re-sync them on every piece.
  for (const p of plan.pieces) {
    if (p.materialId !== id) continue;
    for (const d of m.fixed) p[d] = m[d];
  }
}

export function removeMaterial(id) {
  plan.materials = plan.materials.filter((m) => m.id !== id);
  if (pieceById(plan.selectedId)?.materialId === id) plan.selectedId = null;
  plan.pieces = plan.pieces.filter((p) => p.materialId !== id);
  plan.hiddenIds = plan.hiddenIds.filter((hid) => plan.pieces.some((p) => p.id === hid));
}

export function addPiece(materialId) {
  const m = materialById(materialId);
  if (!m) return;
  const n = plan.pieces.length;
  plan.pieces.push({
    id: nextId,
    materialId,
    w: m.w,
    h: m.h,
    l: m.l,
    x: (n % 4) * 12 - 18,
    y: 0,
    z: (Math.floor(n / 4) % 4) * 12 - 18,
    rx: 0,
    ry: 0,
    rz: 0,
  });
  plan.selectedId = nextId++;
}

export function duplicatePiece(id) {
  const p = pieceById(id);
  if (!p) return;
  plan.pieces.push({ ...p, id: nextId });
  plan.selectedId = nextId++;
}

export function removePiece(id) {
  plan.pieces = plan.pieces.filter((p) => p.id !== id);
  plan.hiddenIds = plan.hiddenIds.filter((hid) => hid !== id);
  if (plan.selectedId === id) plan.selectedId = null;
}

export function togglePieceHidden(id) {
  const i = plan.hiddenIds.indexOf(id);
  if (i >= 0) {
    plan.hiddenIds.splice(i, 1);
  } else {
    plan.hiddenIds.push(id);
    if (plan.selectedId === id) plan.selectedId = null;
  }
}
