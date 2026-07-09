<script>
	import * as THREE from "three";
	import { OrbitControls } from "three/addons/controls/OrbitControls.js";
	import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
	import { OBB } from "three/addons/math/OBB.js";
	import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";
	import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
	import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
	import { LineMaterial } from "three/addons/lines/LineMaterial.js";
	import { onMount } from "svelte";
	import { plan, materialById, pieceById, fixedDims } from "./state.svelte.js";
	import { formatLen } from "./units.js";

	const DEG = Math.PI / 180;
	const UNSELECTED_EDGE = 0x4a3b28;
	const SELECTED_EDGE = 0x1d4ed8;
	// Shrink each OBB by this much per side so pieces butted flush against each
	// other read as touching, not overlapping.
	const OVERLAP_TOLERANCE = 0.02;
	// Edge line widths in px; x-ray mode thickens outlines and drops face
	// opacity so pieces behind stay visible.
	const EDGE_WIDTH = 1;
	const XRAY_EDGE_WIDTH = 1;
	const XRAY_OPACITY = 0.25;

	let container;
	let ready = $state(false);

	let renderer, scene, camera, controls, labelRenderer;
	let dimLabel = null; // CSS2DObject shown while a resize drag is active
	const meshes = new Map(); // piece id -> Mesh
	const raycaster = new THREE.Raycaster();
	const ndc = new THREE.Vector2();
	// Unit box shifted so the local origin is the minimum corner; scaling by
	// (w, h, l) makes the box span [0,w] × [0,h] × [0,l] from the piece origin.
	const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0.5, 0.5);
	const unitEdges = new THREE.EdgesGeometry(unitBox);
	// Fat-line version of the edges: LineBasicMaterial linewidth is ignored by
	// WebGL, so outlines use LineSegments2, whose width is set in pixels.
	const unitEdgesWide = new LineSegmentsGeometry().fromEdgesGeometry(unitEdges);

	let drag = null; // { id, plane, offset, vertical }
	let down = null; // { x, y, hit }

	onMount(() => {
		scene = new THREE.Scene();
		scene.background = new THREE.Color(0xeef1f4);

		camera = new THREE.PerspectiveCamera(50, 1, 0.1, 5000);
		camera.position.set(90, 80, 130);

		renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		container.appendChild(renderer.domElement);

		labelRenderer = new CSS2DRenderer();
		labelRenderer.domElement.style.position = "absolute";
		labelRenderer.domElement.style.inset = "0";
		labelRenderer.domElement.style.pointerEvents = "none";
		container.appendChild(labelRenderer.domElement);

		controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		controls.dampingFactor = 0.08;
		controls.target.set(0, 8, 0);
		controls.addEventListener("change", requestRender);

		scene.add(new THREE.HemisphereLight(0xffffff, 0x99a3ad, 1.1));
		const sun = new THREE.DirectionalLight(0xffffff, 1.8);
		sun.position.set(70, 140, 50);
		sun.castShadow = true;
		sun.shadow.mapSize.set(2048, 2048);
		sun.shadow.camera.left = -200;
		sun.shadow.camera.right = 200;
		sun.shadow.camera.top = 200;
		sun.shadow.camera.bottom = -200;
		sun.shadow.camera.near = 1;
		sun.shadow.camera.far = 500;
		scene.add(sun);

		const ground = new THREE.Mesh(
			new THREE.PlaneGeometry(1200, 1200),
			new THREE.MeshStandardMaterial({ color: 0xe3e7ea, roughness: 1 })
		);
		ground.rotation.x = -Math.PI / 2;
		ground.position.y = -0.06;
		ground.receiveShadow = true;
		scene.add(ground);

		const grid = new THREE.GridHelper(384, 32, 0xa8b1b9, 0xccd2d8);
		grid.position.y = -0.02;
		scene.add(grid);

		const ro = new ResizeObserver(resize);
		ro.observe(container);
		resize();

		ready = true;

		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
			hideDimLabel();
			controls.dispose();
			for (const mesh of meshes.values()) disposeMesh(mesh);
			meshes.clear();
			updateOverlapMeshes([]);
			overlapMaterial.dispose();
			renderer.dispose();
			renderer.domElement.remove();
			labelRenderer.domElement.remove();
		};
	});

	// Render on demand: frames are coalesced through requestRender(), triggered
	// by OrbitControls 'change' events and the state-sync $effect. While damping
	// is settling, controls.update() keeps firing 'change', which re-queues the
	// next frame until it converges.
	let raf = 0;
	let renderQueued = false;

	function requestRender() {
		if (renderQueued || !renderer) return;
		renderQueued = true;
		raf = requestAnimationFrame(() => {
			renderQueued = false;
			controls.update();
			renderer.render(scene, camera);
			labelRenderer.render(scene, camera);
		});
	}

	function resize() {
		const w = container.clientWidth;
		const h = container.clientHeight;
		if (!w || !h) return;
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		renderer.setSize(w, h);
		labelRenderer.setSize(w, h);
		// LineMaterial needs the viewport size to convert linewidth px to clip space.
		for (const mesh of meshes.values()) mesh.children[0].material.resolution.set(w, h);
		requestRender();
	}

	function createMesh(id) {
		const mesh = new THREE.Mesh(unitBox, new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 }));
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		mesh.userData.id = id;
		const edges = new LineSegments2(unitEdgesWide, new LineMaterial({ color: UNSELECTED_EDGE, linewidth: EDGE_WIDTH }));
		edges.material.resolution.set(container.clientWidth, container.clientHeight);
		edges.raycast = () => {};
		mesh.add(edges);
		scene.add(mesh);
		return mesh;
	}

	function disposeMesh(mesh) {
		scene.remove(mesh);
		mesh.material.dispose();
		mesh.children[0].material.dispose();
	}

	// Oriented bounding box for a piece, shrunk by OVERLAP_TOLERANCE per side.
	function pieceOBB(p) {
		const rot = new THREE.Euler(p.rx * DEG, p.ry * DEG, p.rz * DEG);
		const obb = new OBB();
		obb.halfSize.set(
			Math.max(p.w / 2 - OVERLAP_TOLERANCE, 1e-4),
			Math.max(p.h / 2 - OVERLAP_TOLERANCE, 1e-4),
			Math.max(p.l / 2 - OVERLAP_TOLERANCE, 1e-4)
		);
		obb.rotation.setFromMatrix4(new THREE.Matrix4().makeRotationFromEuler(rot));
		obb.center
			.set(p.w / 2, p.h / 2, p.l / 2)
			.applyEuler(rot)
			.add(new THREE.Vector3(p.x, p.y, p.z));
		return obb;
	}

	function overlappingPairs(hidden) {
		const pairs = [];
		const pieces = plan.pieces.filter((p) => !hidden.has(p.id));
		const obbs = pieces.map(pieceOBB);
		for (let i = 0; i < obbs.length; i++) {
			for (let j = i + 1; j < obbs.length; j++) {
				if (obbs[i].intersectsOBB(obbs[j])) pairs.push([pieces[i], pieces[j]]);
			}
		}
		return pairs;
	}

	// Corner index is cx*4 + cy*2 + cz; each face is a quad loop of corners.
	const BOX_FACES = [
		[0, 1, 3, 2],
		[4, 5, 7, 6],
		[0, 1, 5, 4],
		[2, 3, 7, 6],
		[0, 2, 6, 4],
		[1, 3, 7, 5]
	];

	// World-space corners and outward face planes of a piece's box, inset by
	// OVERLAP_TOLERANCE per side so the solids match overlap detection and never
	// sit exactly coplanar with piece faces (which would z-fight).
	function pieceBoxData(p) {
		const rot = new THREE.Euler(p.rx * DEG, p.ry * DEG, p.rz * DEG);
		const axes = [
			new THREE.Vector3(1, 0, 0).applyEuler(rot),
			new THREE.Vector3(0, 1, 0).applyEuler(rot),
			new THREE.Vector3(0, 0, 1).applyEuler(rot)
		];
		const dims = [p.w, p.h, p.l].map((d) => Math.max(d - 2 * OVERLAP_TOLERANCE, 1e-3));
		const origin = new THREE.Vector3(p.x, p.y, p.z);
		for (const a of axes) origin.addScaledVector(a, OVERLAP_TOLERANCE);
		const corners = [];
		for (const cx of [0, 1]) {
			for (const cy of [0, 1]) {
				for (const cz of [0, 1]) {
					corners.push(
						origin
							.clone()
							.addScaledVector(axes[0], cx * dims[0])
							.addScaledVector(axes[1], cy * dims[1])
							.addScaledVector(axes[2], cz * dims[2])
					);
				}
			}
		}
		const planes = [];
		for (let i = 0; i < 3; i++) {
			planes.push(new THREE.Plane().setFromNormalAndCoplanarPoint(axes[i].clone().negate(), origin));
			planes.push(
				new THREE.Plane().setFromNormalAndCoplanarPoint(axes[i], origin.clone().addScaledVector(axes[i], dims[i]))
			);
		}
		return { corners, planes };
	}

	// Sutherland–Hodgman: the part of a convex polygon on the inner side of an
	// outward-facing plane.
	function clipPolygon(poly, plane) {
		const EPS = 1e-6;
		const out = [];
		for (let i = 0; i < poly.length; i++) {
			const a = poly[i];
			const b = poly[(i + 1) % poly.length];
			const da = plane.distanceToPoint(a);
			const db = plane.distanceToPoint(b);
			if (da <= EPS) out.push(a);
			if ((da < -EPS && db > EPS) || (da > EPS && db < -EPS)) out.push(a.clone().lerp(b, da / (da - db)));
		}
		return out;
	}

	function clippedFacePoints(box, planes) {
		const pts = [];
		for (const face of BOX_FACES) {
			let poly = face.map((i) => box.corners[i]);
			for (const plane of planes) {
				poly = clipPolygon(poly, plane);
				if (!poly.length) break;
			}
			pts.push(...poly);
		}
		return pts;
	}

	// Convex solid where two pieces interpenetrate. Every vertex of A∩B lies on
	// A's or B's boundary, so clipping each box's faces by the other's planes
	// and hulling the surviving points reconstructs the intersection exactly.
	function intersectionGeometry(a, b) {
		const boxA = pieceBoxData(a);
		const boxB = pieceBoxData(b);
		const pts = [...clippedFacePoints(boxA, boxB.planes), ...clippedFacePoints(boxB, boxA.planes)];
		const uniq = [];
		outer: for (const p of pts) {
			for (const q of uniq) if (q.distanceToSquared(p) < 1e-8) continue outer;
			uniq.push(p);
		}
		if (uniq.length < 4) return null;
		try {
			return new ConvexGeometry(uniq);
		} catch {
			return null; // degenerate sliver
		}
	}

	let overlapMeshes = [];
	const overlapMaterial = new THREE.MeshStandardMaterial({
		color: 0xff5a36,
		emissive: 0xdc2626,
		emissiveIntensity: 0.55,
		roughness: 0.6
	});

	function updateOverlapMeshes(pairs) {
		for (const m of overlapMeshes) {
			scene.remove(m);
			m.geometry.dispose();
		}
		overlapMeshes = [];
		for (const [a, b] of pairs) {
			const geo = intersectionGeometry(a, b);
			if (!geo) continue;
			const mesh = new THREE.Mesh(geo, overlapMaterial);
			scene.add(mesh);
			overlapMeshes.push(mesh);
		}
	}

	// Hidden pieces keep their mesh (visible = false) but can't be clicked.
	function pickTargets() {
		return [...meshes.values()].filter((m) => m.visible);
	}

	// Sync Three.js objects from reactive state (pieces, materials, selection).
	$effect(() => {
		if (!ready) return;
		const seen = new Set();
		for (const p of plan.pieces) {
			seen.add(p.id);
			let mesh = meshes.get(p.id);
			if (!mesh) {
				mesh = createMesh(p.id);
				meshes.set(p.id, mesh);
			}
			mesh.scale.set(p.w, p.h, p.l);
			mesh.position.set(p.x, p.y, p.z);
			mesh.rotation.set(p.rx * DEG, p.ry * DEG, p.rz * DEG);
		}
		for (const [id, mesh] of meshes) {
			if (!seen.has(id)) {
				disposeMesh(mesh);
				meshes.delete(id);
			}
		}
		// Collisions are only marked by the intersection solids in x-ray view;
		// pieces themselves always render normally, with selection blue.
		const hidden = new Set(plan.hiddenIds);
		const xray = plan.view === "xray";
		for (const p of plan.pieces) {
			const mesh = meshes.get(p.id);
			mesh.visible = !hidden.has(p.id);
			const selected = p.id === plan.selectedId;
			mesh.material.color.set(materialById(p.materialId)?.color ?? "#c9a06c");
			mesh.material.emissive.set(selected ? SELECTED_EDGE : 0x000000);
			mesh.material.emissiveIntensity = selected ? 0.35 : 0;
			if (mesh.material.transparent !== xray) {
				mesh.material.transparent = xray;
				mesh.material.opacity = xray ? XRAY_OPACITY : 1;
				// Don't write depth, so pieces behind stay visible through the faces.
				mesh.material.depthWrite = !xray;
				mesh.material.needsUpdate = true;
			}
			mesh.children[0].material.linewidth = xray ? XRAY_EDGE_WIDTH : EDGE_WIDTH;
			mesh.children[0].material.color.set(selected ? SELECTED_EDGE : UNSELECTED_EDGE);
		}
		updateOverlapMeshes(xray ? overlappingPairs(hidden) : []);
		requestRender();
	});

	function setRay(e) {
		const rect = renderer.domElement.getBoundingClientRect();
		ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
		ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
		raycaster.setFromCamera(ndc, camera);
	}

	function snapVal(v) {
		if (!plan.snap) return v;
		const inc = plan.units === "metric" ? 10 / 25.4 : 0.5;
		return Math.round(v / inc) * inc;
	}

	// If the hit is near an edge or corner of the box, return resize drag info:
	// the dimension to change, the outward world direction of the grabbed face,
	// and a point on the fixed opposite face to anchor against. A point is "near
	// an edge" when it is close to two face planes at once, so the middle of any
	// face — including side and end faces — moves the piece instead.
	function resizeInfoAt(hit, p) {
		const mesh = hit.object;
		const local = mesh.worldToLocal(hit.point.clone()); // unit-box coords, 0..1 per axis
		const dims = { x: p.w, y: p.h, z: p.l };
		const dist = {};
		const zone = {};
		for (const a of ["x", "y", "z"]) {
			dist[a] = Math.min(local[a], 1 - local[a]) * dims[a];
			zone[a] = Math.min(1.5, dims[a] / 3);
		}
		const nearCount = ["x", "y", "z"].filter((a) => dist[a] < zone[a]).length;
		if (nearCount < 2) return null;
		// Resize width or length only (never thickness), skipping dims the
		// material fixes; pick the nearer eligible side.
		const fixed = fixedDims(p.materialId);
		const canW = !fixed.has("w") && dist.x < zone.x;
		const canL = !fixed.has("l") && dist.z < zone.z;
		let axis = null;
		if (canW && (!canL || dist.x <= dist.z)) axis = "w";
		else if (canL) axis = "l";
		if (!axis) return null;
		const sign = (axis === "w" ? local.x : local.z) >= 0.5 ? 1 : -1;
		const dim = axis === "w" ? p.w : p.l;
		const axisW = new THREE.Vector3(axis === "w" ? 1 : 0, 0, axis === "w" ? 0 : 1)
			.applyQuaternion(mesh.quaternion)
			.normalize();
		const dir = axisW.clone().multiplyScalar(sign); // outward from the grabbed face
		// Anchor sits on the face that stays fixed: the origin corner for a +face
		// grab, or the far face for a -face grab.
		const anchor = sign > 0 ? mesh.position.clone() : mesh.position.clone().addScaledVector(axisW, dim);
		// Drag plane contains the resize axis and faces the camera as much as possible.
		const camDir = camera.getWorldDirection(new THREE.Vector3());
		const normal = new THREE.Vector3().crossVectors(dir, new THREE.Vector3().crossVectors(camDir, dir));
		if (normal.lengthSq() < 1e-9) return null; // looking straight down the axis
		const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal.normalize(), anchor);
		return { axis, sign, dir, anchor, plane };
	}

	// Live dimension readout during a resize drag: an HTML label anchored to the
	// top edge of the moving face (unit-box local coords, so it tracks the mesh).
	function showDimLabel(mesh) {
		const el = document.createElement("div");
		el.className = "dim-label";
		dimLabel = new CSS2DObject(el);
		dimLabel.position.set(
			drag.axis === "w" ? (drag.sign > 0 ? 1 : 0) : 0.5,
			1,
			drag.axis === "l" ? (drag.sign > 0 ? 1 : 0) : 0.5
		);
		mesh.add(dimLabel);
		updateDimLabel();
	}

	function updateDimLabel() {
		const p = dimLabel && pieceById(drag.id);
		if (p) dimLabel.element.textContent = formatLen(p[drag.axis], plan.units);
	}

	function hideDimLabel() {
		dimLabel?.removeFromParent();
		dimLabel = null;
	}

	function resizeCursor(point, dir) {
		const a = point.clone().project(camera);
		const b = point.clone().addScaledVector(dir, 1).project(camera);
		const dx = b.x - a.x;
		const dy = -(b.y - a.y); // screen-down positive
		let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
		if (deg < 0) deg += 180;
		if (deg < 22.5 || deg >= 157.5) return "ew-resize";
		if (deg < 67.5) return "nwse-resize";
		if (deg < 112.5) return "ns-resize";
		return "nesw-resize";
	}

	function onPointerDown(e) {
		if (e.button !== 0) return;
		setRay(e);
		const hits = raycaster.intersectObjects(pickTargets(), false);
		down = { x: e.clientX, y: e.clientY, hit: hits.length > 0 };
		if (!hits.length) return;
		// A piece was hit: claim the gesture so OrbitControls never sees it.
		e.stopPropagation();
		const id = hits[0].object.userData.id;
		// The first click only selects; move/resize requires a fresh gesture on an
		// already-selected piece, so a selection click can't nudge the piece.
		if (plan.selectedId !== id) {
			plan.selectedId = id;
			container.style.cursor = "pointer";
			return;
		}
		const p = pieceById(id);
		const point = hits[0].point;

		const resize = e.shiftKey ? null : resizeInfoAt(hits[0], p);
		if (resize) {
			drag = { mode: "resize", id, ...resize };
			container.style.cursor = resizeCursor(point, resize.dir);
			showDimLabel(hits[0].object);
		} else {
			let plane;
			if (e.shiftKey) {
				const n = new THREE.Vector3();
				camera.getWorldDirection(n);
				n.y = 0;
				if (n.lengthSq() < 1e-6) n.set(0, 0, 1);
				n.normalize();
				plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, point);
			} else {
				plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -point.y);
			}
			drag = {
				mode: "move",
				id,
				plane,
				vertical: e.shiftKey,
				offset: point.clone().sub(new THREE.Vector3(p.x, p.y, p.z))
			};
			container.style.cursor = "grabbing";
		}
		container.setPointerCapture(e.pointerId);
	}

	function onPointerMove(e) {
		if (drag) {
			e.stopPropagation();
			setRay(e);
			const pt = new THREE.Vector3();
			if (!raycaster.ray.intersectPlane(drag.plane, pt)) return;
			const p = pieceById(drag.id);
			if (!p) return;
			if (drag.mode === "resize") {
				let extent = pt.sub(drag.anchor).dot(drag.dir);
				if (plan.snap) {
					const inc = plan.units === "metric" ? 10 / 25.4 : 1;
					extent = Math.round(extent / inc) * inc;
				}
				extent = Math.max(extent, 0.25);
				p[drag.axis] = extent;
				// Grabbing the -face moves the origin corner; the far face stays fixed.
				if (drag.sign < 0) {
					const c = drag.anchor.clone().addScaledVector(drag.dir, extent);
					p.x = c.x;
					p.y = c.y;
					p.z = c.z;
				}
				updateDimLabel();
			} else {
				pt.sub(drag.offset);
				if (drag.vertical) {
					p.y = Math.max(snapVal(pt.y), 0);
				} else {
					p.x = snapVal(pt.x);
					p.z = snapVal(pt.z);
				}
			}
		} else if (!down) {
			setRay(e);
			const hits = raycaster.intersectObjects(pickTargets(), false);
			if (!hits.length) {
				container.style.cursor = "default";
				return;
			}
			const p = pieceById(hits[0].object.userData.id);
			if (!p || p.id !== plan.selectedId) {
				container.style.cursor = "pointer";
				return;
			}
			const info = e.shiftKey ? null : resizeInfoAt(hits[0], p);
			container.style.cursor = info ? resizeCursor(hits[0].point, info.dir) : "grab";
		}
	}

	function onPointerUp(e) {
		if (drag) {
			if (container.hasPointerCapture(e.pointerId)) container.releasePointerCapture(e.pointerId);
			hideDimLabel();
			drag = null;
			container.style.cursor = "grab";
			requestRender();
		} else if (down && !down.hit) {
			const dx = e.clientX - down.x;
			const dy = e.clientY - down.y;
			if (dx * dx + dy * dy < 25) plan.selectedId = null;
		}
		down = null;
	}
</script>

<div
	class="scene"
	bind:this={container}
	onpointerdowncapture={onPointerDown}
	onpointermovecapture={onPointerMove}
	onpointerupcapture={onPointerUp}
	onpointercancelcapture={onPointerUp}
>
	{#if plan.pieces.length === 0}
		<div class="empty-hint">Add a piece from a material in the sidebar to get started</div>
	{/if}
	<div class="controls-hint">
		click: select &nbsp;·&nbsp; drag selected: move &nbsp;·&nbsp; drag edge: resize &nbsp;·&nbsp; shift-drag:
		raise/lower &nbsp;·&nbsp; left-drag: orbit &nbsp;·&nbsp; right-drag: pan &nbsp;·&nbsp; scroll: zoom
	</div>
</div>

<style>
	.scene {
		position: relative;
		flex: 1;
		min-width: 0;
		overflow: hidden;
	}

	.scene :global(canvas) {
		display: block;
	}

	.scene :global(.dim-label) {
		background: rgba(29, 78, 216, 0.92);
		color: #fff;
		font-size: 12px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		padding: 2px 7px;
		border-radius: 5px;
		white-space: nowrap;
		margin-top: -16px;
	}

	.empty-hint {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #6b7280;
		font-size: 15px;
		pointer-events: none;
	}

	.controls-hint {
		position: absolute;
		bottom: 10px;
		left: 50%;
		transform: translateX(-50%);
		background: rgba(255, 255, 255, 0.85);
		border: 1px solid #dde1e6;
		border-radius: 6px;
		padding: 4px 12px;
		font-size: 12px;
		color: #6b7280;
		white-space: nowrap;
		pointer-events: none;
	}
</style>
