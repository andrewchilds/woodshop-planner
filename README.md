# Woodshop Planner

https://github.com/user-attachments/assets/be23af57-0b93-438e-b8fa-b518c8df8e5a

A simple, offline, web-based 3D woodworking plan editor.

Built with Svelte and Three.js.

## Usage

```sh
npm install
npm run dev
```

Then open the printed local URL.

## Features

- **Materials** — define material types (e.g. `2x4`, `3/4" plywood`) with stock
  dimensions and a color, then drop pieces of them into the 3D scene.
- **Fixed vs. variable dimensions** — each material marks which dimensions are
  fixed to the stock size (a 2x4's width and thickness, a sheet's thickness).
  Fixed dimensions can't be resized on pieces; variable ones can be cut to any size.
- **Cut list & cut diagrams** — pieces are grouped by material and size with
  quantities and a buy count of how many boards/sheets you need. Each material's
  cut diagram shows how to cut the pieces from stock: sheet goods use an efficient
  guillotine layout (every cut runs edge to edge, like a table saw) with same-size
  pieces sharing cut lines, dimensional lumber is packed along its length, and all
  cuts include a 1/8" kerf allowance.
- **X-ray view** — renders pieces as translucent outlines so you can see through
  the assembly, and highlights in red the exact volume where any two pieces
  overlap or collide.

Plus the basics: drag to move and resize pieces in 3D, imperial/metric units,
snapping, undo/redo, keyboard shortcuts, and autosave with named projects and
JSON import/export.

## License

[MIT](LICENSE)
