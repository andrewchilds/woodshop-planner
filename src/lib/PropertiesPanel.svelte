<script>
  import {
    plan,
    selectedPiece,
    materialById,
    fixedDims,
    duplicatePiece,
    removePiece,
  } from './state.svelte.js';
  import DimInput from './DimInput.svelte';
  import { unitLabel } from './units.js';
  import Copy from '@lucide/svelte/icons/copy';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import RotateCw from '@lucide/svelte/icons/rotate-cw';

  const sel = $derived(selectedPiece());
  const selFixed = $derived(sel ? fixedDims(sel.materialId) : new Set());

  // Switching materials snaps the piece's fixed dims to the new stock size.
  function changeMaterial(id) {
    const m = materialById(id);
    if (!m) return;
    sel.materialId = id;
    for (const a of m.fixed ?? []) sel[a] = m[a];
  }

  // Shift+arrow steps rotation by 15°, preserving any decimal part (native
  // number-input stepping would snap to multiples of the step attribute).
  function onRotKeydown(e, key) {
    if (!e.shiftKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const typed = parseFloat(e.currentTarget.value);
    const base = Number.isNaN(typed) ? sel[key] : typed;
    sel[key] = base + (e.key === 'ArrowUp' ? 15 : -15);
  }
</script>

<aside>
  <section>
    <h3>Selected piece</h3>
    {#if sel}
      <label class="field">
        Material
        <select
          value={sel.materialId}
          onchange={(e) => changeMaterial(Number(e.currentTarget.value))}
        >
          {#each plan.materials as m (m.id)}
            <option value={m.id}>{m.name}</option>
          {/each}
        </select>
      </label>

      <h4>Dimensions ({unitLabel(plan.units)})</h4>
      <div class="dim-grid">
        {#each [['w', 'W'], ['h', 'H'], ['l', 'L']] as [key, label] (key)}
          <label>
            {label}
            <DimInput
              value={sel[key]}
              min={0.01}
              disabled={selFixed.has(key)}
              title={selFixed.has(key) ? 'Fixed by material' : null}
              onchange={(v) => (sel[key] = v)}
            />
          </label>
        {/each}
      </div>

      <h4>Position ({unitLabel(plan.units)})</h4>
      <div class="dim-grid">
        <label>X <DimInput value={sel.x} onchange={(v) => (sel.x = v)} /></label>
        <label>Y <DimInput value={sel.y} onchange={(v) => (sel.y = v)} /></label>
        <label>Z <DimInput value={sel.z} onchange={(v) => (sel.z = v)} /></label>
      </div>

      <h4>Rotation (°)</h4>
      <div class="rot-grid">
        {#each [['rx', 'X'], ['ry', 'Y'], ['rz', 'Z']] as [key, axis] (key)}
          <label>
            {axis}
            <input
              type="number"
              step="15"
              value={sel[key]}
              onkeydown={(e) => onRotKeydown(e, key)}
              onchange={(e) => (sel[key] = Number(e.currentTarget.value) || 0)}
            />
            <button
              class="btn"
              onclick={() => (sel[key] = (sel[key] + 90) % 360)}
              title="Rotate 90° around {axis}"
            >
              <RotateCw size={13} /> 90°
            </button>
          </label>
        {/each}
      </div>

      <div class="row">
        <button class="btn" onclick={() => duplicatePiece(sel.id)}>
          <Copy size={13} /> Duplicate
        </button>
        <button class="btn danger" onclick={() => removePiece(sel.id)}>
          <Trash2 size={13} /> Delete
        </button>
      </div>
    {:else}
      <p class="hint">Click a piece in the 3D view, or add one from a material.</p>
    {/if}
  </section>
</aside>

<style>
  aside {
    width: 280px;
    flex-shrink: 0;
    overflow-y: auto;
    background: #fafbfc;
    border-left: 1px solid #e2e5e9;
  }

  section {
    padding: 14px 16px;
    border-bottom: 1px solid #e9ecef;
  }

  h3 {
    margin: 0 0 10px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #6b7280;
  }

  h4 {
    margin: 12px 0 6px;
    font-size: 12px;
    font-weight: 600;
    color: #4b5563;
  }

  .dim-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 6px;
  }

  .dim-grid label {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 11px;
    font-weight: 600;
    color: #6b7280;
  }

  .rot-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .rot-grid label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
  }

  .rot-grid input {
    flex: 1;
    min-width: 0;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
  }
</style>
