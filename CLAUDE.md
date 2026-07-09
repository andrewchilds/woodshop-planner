# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — dev server on port 5191 (strictPort; fails if taken)
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the build, also on 5191

There are no tests or linters.

## What this is

A single-page, client-side-only 3D woodworking plan editor (Svelte 5 runes + Three.js). No backend; all persistence is `localStorage` plus JSON file import/export.

## Architecture

All app state lives in one reactive `plan` object exported from `src/lib/state.svelte.js` (a `.svelte.js` module so `$state` works outside components). Components mutate `plan` directly; there are no events/stores beyond this.

**Coordinate/unit conventions** (relied on everywhere — Scene, Sidebar, CutList, migrations):
- All dimensions and positions are stored in **inches**, always. Metric is display-only, converted at the input/format boundary by `src/lib/units.js` (`toDisplay`/`fromDisplay`/`formatLen`).
- Piece dims map to axes as w → x, h → y, l → z.
- A piece's position is its **origin corner** (the minimum corner when unrotated), not its center; rotation pivots around that corner. Scene.svelte implements this with a shared unit `BoxGeometry` translated by (0.5, 0.5, 0.5) and then scaled by (w, h, l) per mesh.

**Persistence, undo, and schema versioning** are coupled:
- A debounced (300 ms) `$effect` in `App.svelte` both autosaves to `localStorage` and calls `recordHistory()`. Undo history entries are full serialized JSON snapshots; the debounce is what collapses a continuous drag into a single undo step. Don't add separate history recording elsewhere — route changes through `plan` and let the effect pick them up.
- Saved data carries `FORMAT_VERSION`; `migrate()` in state.svelte.js upgrades older saves (v1 center-origin positions, v2 missing `fixed` dims). If you change the serialized shape, bump the version and add a migration branch.
- IDs are shared across materials and pieces via a single `nextId` counter, recomputed (`refreshNextId`) whenever a whole plan is loaded.

**Scene.svelte** bridges reactive state to imperative Three.js: a `$effect` diffs `plan.pieces` against a `Map` of meshes (create/update/dispose). Pointer handlers are attached with **capture-phase** events (`onpointerdowncapture` etc.) and call `stopPropagation()` when a piece is hit, so OrbitControls (which listens on the canvas) never sees gestures that belong to piece manipulation.

**Interaction rules encoded in Scene.svelte:**
- A click on an unselected piece only selects it; move/resize requires a fresh drag on an already-selected piece (prevents selection clicks from nudging pieces).
- Hits near two face planes at once (edge/corner zones) start a resize; `resizeInfoAt` picks width or length (never thickness), skipping dimensions the material marks `fixed`, and anchors the opposite face so it stays put.
- Materials' `fixed` array ('w'/'h'/'l') locks dims to stock size — respected by both drag-resize and the Sidebar dimension inputs.
- Snap increments differ by gesture: moves snap to 1/2" (10 mm metric), resizes to 1" (10 mm metric), input arrow-keys step 1/8" (1 mm).
