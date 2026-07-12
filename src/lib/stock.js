// Estimates how many pieces of stock (boards/sheets) to buy per material,
// including the cut layout on each one. Which dims are cuttable comes from
// the material's `fixed` array: 2 fixed → dimensional lumber (1D cuts along
// the free axis), 1 fixed → sheet goods (2D cuts across the two free axes),
// all fixed → bought per piece.
//
// Sheets use a guillotine layout (every cut runs edge to edge, like a table
// saw): a sheet is ripped into full-width shelves, shelves are crosscut into
// columns, columns are ripped into pieces. Placement prefers exact width/
// height matches so same-size pieces share cut lines, and several candidate
// orderings are tried, keeping the one with the fewest sheets, then the
// fewest cuts. All cuts include a saw-kerf allowance.
export const KERF = 0.125;
const EPS = 1e-9;
const DIMS = ['w', 'h', 'l'];

// 1D first-fit-decreasing: cut lengths into sticks of stockLen.
function packLengths(lengths, stockLen) {
  const bins = []; // { used, cuts: [{ x, len }] }
  const unplaced = [];
  for (const len of lengths.toSorted((a, b) => b - a)) {
    if (len > stockLen) {
      unplaced.push(len);
      continue;
    }
    let bin = bins.find((b) => b.used + len <= stockLen);
    if (!bin) bins.push((bin = { used: 0, cuts: [] }));
    bin.cuts.push({ x: bin.used, len });
    bin.used += len + KERF;
  }
  return { bins, unplaced };
}

// --- 2D guillotine shelf/column packing ---

const SORTS = [
  (a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || Math.min(b.w, b.h) - Math.min(a.w, a.h),
  (a, b) => Math.min(b.w, b.h) - Math.min(a.w, a.h) || Math.max(b.w, b.h) - Math.max(a.w, a.h),
  (a, b) => b.w * b.h - a.w * a.h,
];

function packRects(rects, binW, binH) {
  let best = null;
  for (const sort of SORTS) {
    for (const preferTall of [false, true]) {
      const sorted = rects.toSorted(sort);
      const bins = [];
      const unplaced = [];
      for (const r of sorted) {
        if (!placeRect(bins, r, binW, binH, preferTall)) unplaced.push(r);
      }
      const candidate = { bins, unplaced };
      if (!best || scoreLess(score(candidate), score(best))) best = candidate;
    }
  }
  return best;
}

// [unplaced, bins, cuts (≈ shelves + columns), last-bin fill] — lexicographic,
// lower is better. Preferring an emptier last bin keeps the offcut usable.
function score({ bins, unplaced }) {
  let cuts = 0;
  for (const bin of bins) {
    for (const s of bin.shelves) cuts += 1 + s.cols.length;
  }
  return [unplaced.length, bins.length, cuts, bins.at(-1)?.used ?? 0];
}

function scoreLess(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

// Orientations to try, as [width, height]. preferTall stands pieces up
// (long side vertical) first, preferWide lays them down first.
function orientations(r, preferTall) {
  const long = Math.max(r.w, r.h);
  const short = Math.min(r.w, r.h);
  if (long === short) return [[long, short]];
  return preferTall
    ? [
        [short, long],
        [long, short],
      ]
    : [
        [long, short],
        [short, long],
      ];
}

function placeRect(bins, r, binW, binH, preferTall) {
  const orients = orientations(r, preferTall);

  // 1. Stack onto an existing column, exact width matches first — the
  //    column's rip cut then severs every piece in it.
  for (const exact of [true, false]) {
    for (const bin of bins) {
      for (const shelf of bin.shelves) {
        for (const col of shelf.cols) {
          for (const [w, h] of orients) {
            const fitsW = exact ? Math.abs(w - col.w) < EPS : w <= col.w + EPS;
            if (fitsW && col.used + h <= shelf.h + EPS) {
              const rect = { x: col.x, y: shelf.y + col.used, w, h };
              bin.rects.push(rect);
              col.rects.push(rect);
              col.used += h + KERF;
              return true;
            }
          }
        }
      }
    }
  }

  // 2. New column in an existing shelf, exact height matches first — the
  //    shelf's rip cut then severs every full-height piece on it.
  for (const exact of [true, false]) {
    for (const bin of bins) {
      for (const shelf of bin.shelves) {
        for (const [w, h] of orients) {
          const fitsH = exact ? Math.abs(h - shelf.h) < EPS : h <= shelf.h + EPS;
          if (fitsH && shelf.used + w <= binW + EPS) {
            const rect = { x: shelf.used, y: shelf.y, w, h };
            bin.rects.push(rect);
            shelf.cols.push({ x: shelf.used, w, used: h + KERF, rects: [rect] });
            shelf.used += w + KERF;
            return true;
          }
        }
      }
    }
  }

  // 3. New shelf in an existing bin, else a new bin.
  for (const bin of bins) {
    for (const [w, h] of orients) {
      if (w <= binW + EPS && bin.used + h <= binH + EPS) {
        addShelf(bin, w, h);
        return true;
      }
    }
  }
  for (const [w, h] of orients) {
    if (w <= binW + EPS && h <= binH + EPS) {
      const bin = { shelves: [], rects: [], used: 0 };
      bins.push(bin);
      addShelf(bin, w, h);
      return true;
    }
  }
  return false;
}

function addShelf(bin, w, h) {
  const rect = { x: 0, y: bin.used, w, h };
  bin.rects.push(rect);
  bin.shelves.push({
    y: bin.used,
    h,
    used: w + KERF,
    cols: [{ x: 0, w, used: h + KERF, rects: [rect] }],
  });
  bin.used += h + KERF;
}

// The guillotine cut lines for one sheet, skipping any flush with a stock
// edge: shelf rips run the full sheet width, column crosscuts run the shelf
// height, and piece rips run the column width.
function sheetCuts(bin, binW, binH) {
  const cuts = [];
  for (const shelf of bin.shelves) {
    const bottom = shelf.y + shelf.h;
    if (bottom < binH - EPS) cuts.push({ x1: 0, y1: bottom, x2: binW, y2: bottom });
    for (const col of shelf.cols) {
      const right = col.x + col.w;
      if (right < binW - EPS) cuts.push({ x1: right, y1: shelf.y, x2: right, y2: bottom });
      for (const r of col.rects) {
        const rb = r.y + r.h;
        if (rb < bottom - EPS) cuts.push({ x1: col.x, y1: rb, x2: right, y2: rb });
      }
    }
  }
  return cuts;
}

// How much stock to buy for one material, with the cut layout. Returns null
// with no pieces, else:
//   {
//     unit: 'board' | 'sheet' | 'item',
//     count,                 // stock units to buy
//     unplaced,              // pieces too big to cut from a single stock unit
//     binW, binH,            // stock face being cut, in inches
//     bins,                  // per stock unit: { rects: [{ x, y, w, h }] piece
//                            //   placements, cuts: [{ x1, y1, x2, y2 }] cut
//                            //   lines that continue through waste }
//     unplacedSizes,         // [{ w, h }] of the pieces that fit nowhere
//   }
// Boards are laid out as a top view: x along the free axis, full-width cuts.
// `quantity` packs that many copies of every piece (building N of the plan).
export function stockNeeded(material, pieces, quantity = 1) {
  if (!pieces.length) return null;
  if (quantity > 1) pieces = Array.from({ length: quantity }, () => pieces).flat();
  const fixed = new Set(material.fixed ?? []);
  const free = DIMS.filter((d) => !fixed.has(d));
  if (free.length === 1) {
    const [d] = free;
    const { bins, unplaced } = packLengths(pieces.map((p) => p[d]), material[d]);
    const binH = Math.max(...DIMS.filter((k) => k !== d).map((k) => material[k]));
    return {
      unit: 'board',
      count: bins.length,
      unplaced: unplaced.length,
      binW: material[d],
      binH,
      bins: bins.map((b) => ({
        rects: b.cuts.map((c) => ({ x: c.x, y: 0, w: c.len, h: binH })),
        cuts: b.cuts
          .filter((c) => c.x + c.len < material[d] - EPS)
          .map((c) => ({ x1: c.x + c.len, y1: 0, x2: c.x + c.len, y2: binH })),
      })),
      unplacedSizes: unplaced.map((len) => ({ w: len, h: binH })),
    };
  }
  if (free.length === 2) {
    const [a, b] = free;
    const rects = pieces.map((p) => ({ w: p[a], h: p[b] }));
    const { bins, unplaced } = packRects(rects, material[a], material[b]);
    return {
      unit: 'sheet',
      count: bins.length,
      unplaced: unplaced.length,
      binW: material[a],
      binH: material[b],
      bins: bins.map((bin) => ({ rects: bin.rects, cuts: sheetCuts(bin, material[a], material[b]) })),
      unplacedSizes: unplaced,
    };
  }
  // Everything fixed (or nothing anchored to stock): one unit per piece.
  return {
    unit: 'item',
    count: pieces.length,
    unplaced: 0,
    binW: 0,
    binH: 0,
    bins: [],
    unplacedSizes: [],
  };
}
