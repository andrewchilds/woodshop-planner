# Woodshop Planner

https://woodshop-planner.vercel.app

<img width="3036" height="2034" alt="Screenshot 2026-07-14 at 1 01 42 PM" src="https://github.com/user-attachments/assets/e7e55f98-db0f-4e1e-8476-3dfd14bebf51" />

A simple, offline, web-based 3D woodworking plan editor. Built with Svelte and Three.js.

## Features

### Materials

Define material types (e.g. `2x4`, `3/4" plywood`) with stock dimensions and a color, then drop pieces of them into the 3D scene.

<img width="618" height="712" alt="Screenshot 2026-07-14 at 1 00 10 PM" src="https://github.com/user-attachments/assets/111ccf47-85c2-424f-89c4-8d47bb58a54e" />
  
### Fixed vs. variable dimensions

<img width="612" height="846" alt="Screenshot 2026-07-14 at 1 00 27 PM" src="https://github.com/user-attachments/assets/480f30de-cc62-4ee8-af16-8ed0ae3a3ad3" />

Each material marks which dimensions are fixed to the stock size (a 2x4's width and thickness, a sheet's thickness). Fixed dimensions can't be resized on pieces; variable ones can be cut to any size.

### Cut list & cut diagrams

<img width="2058" height="1178" alt="Screenshot 2026-07-14 at 1 00 41 PM" src="https://github.com/user-attachments/assets/e5737689-7166-4ee0-9c21-57a0d1983b97" />

Pieces are grouped by material and size with quantities and a buy count of how many boards/sheets you need. Each material's cut diagram shows how to cut the pieces from stock. Cuts include a 1/8" kerf allowance.

### X-ray view

<img width="1562" height="1288" alt="Screenshot 2026-07-14 at 12 59 51 PM" src="https://github.com/user-attachments/assets/cc1b6bb1-9603-418c-a8f6-3674aad58e22" />

Renders pieces as translucent outlines so you can see through the assembly, and highlights in red the exact volume where any two pieces overlap or collide.

## Usage

```sh
npm install
npm run dev
```

Then open the printed local URL.

## License

MIT
