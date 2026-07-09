# Woodshop Planner

https://github.com/andrewchilds/3d-woodshop-planner/raw/main/demo.mp4

A single-page, client-side-only 3D woodworking plan editor built with Svelte 5 and Three.js.

## Usage

```sh
npm install
npm run dev
```

Then open the printed local URL.

## Features

- **Materials** — define material types (e.g. `2x4`, `3/4" plywood`) with default
  width × height × length and a color. A few common ones are seeded.
- **Pieces** — click **+ piece** on a material to drop an instance into the 3D scene.
  Each piece has editable W/H/L, X/Y/Z position, and X/Y/Z rotation (degrees).
  Position is the piece's origin corner (its minimum corner when unrotated), and
  rotation pivots around that corner.
- **3D editing** — click a piece to select it; drag to move it on the ground plane;
  shift-drag to raise/lower it. Drag near an edge or corner to resize the width or
  length on that side, with the opposite face staying put. Left-drag empty
  space to orbit (including below the ground plane, to view from underneath),
  right-drag to pan, scroll to zoom.
- **Units** — toggle between imperial (fractional inches) and metric (mm) in the header.
  All values are stored in inches internally; the toggle changes display and input only.
- **Snap** — optional snapping while dragging: moves snap to 1/2" (10 mm metric),
  edge resizes snap to 1" (10 mm metric).
- **Cut list** — pieces grouped by material type and size (thickness × width × length)
  with quantities. Clicking a row selects each piece of that size in turn.
- **Keyboard** — `Delete`/`Backspace` removes the selected piece, `d` duplicates it,
  `Escape` deselects. In dimension/position fields, `↑`/`↓` step by 1/8" (1 mm) and
  `Shift+↑`/`↓` step by a whole inch (10 mm), snapping to whole multiples.
- **Projects** — the working plan autosaves to `localStorage` continuously. The header
  also lets you save/load named projects (stored in `localStorage`), and export/import
  a project as a plain-text JSON file.
