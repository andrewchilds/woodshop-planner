<script>
  import { plan, addMaterial, updateMaterial, removeMaterial, addPiece } from './state.svelte.js';
  import DimInput from './DimInput.svelte';
  import CutList from './CutList.svelte';
  import { formatLen } from './units.js';
  import Plus from '@lucide/svelte/icons/plus';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Ellipsis from '@lucide/svelte/icons/ellipsis';

  let showMatForm = $state(false); // the new-material form at the bottom
  let editingId = $state(null); // material being edited in place, if any
  let openMenuId = $state(null); // material whose ⋯ menu is open, if any
  let matForm = $state(blankForm());

  function blankForm() {
    return {
      name: '',
      w: 3.5,
      h: 1.5,
      l: 96,
      color: '#c9a06c',
      fixed: { w: true, h: true, l: false },
    };
  }

  function openNewForm() {
    matForm = blankForm();
    editingId = null;
    showMatForm = true;
  }

  function startEdit(m) {
    matForm = {
      name: m.name,
      w: m.w,
      h: m.h,
      l: m.l,
      color: m.color,
      fixed: { w: m.fixed.includes('w'), h: m.fixed.includes('h'), l: m.fixed.includes('l') },
    };
    showMatForm = false;
    editingId = m.id;
    openMenuId = null;
  }

  function cancelForm() {
    showMatForm = false;
    editingId = null;
  }

  function submitMaterial() {
    if (!matForm.name.trim()) return;
    const fields = {
      name: matForm.name.trim(),
      w: matForm.w,
      h: matForm.h,
      l: matForm.l,
      color: matForm.color,
      fixed: ['w', 'h', 'l'].filter((a) => matForm.fixed[a]),
    };
    if (editingId != null) {
      updateMaterial(editingId, fields);
    } else {
      addMaterial(fields);
    }
    cancelForm();
  }

  function confirmRemoveMaterial(m) {
    const count = plan.pieces.filter((p) => p.materialId === m.id).length;
    if (count && !confirm(`Delete "${m.name}" and its ${count} piece${count > 1 ? 's' : ''}?`)) {
      return;
    }
    removeMaterial(m.id);
  }

  function sizeText(m) {
    return `${formatLen(m.h, plan.units)} × ${formatLen(m.w, plan.units)} × ${formatLen(m.l, plan.units)}`;
  }
</script>

<svelte:window onclick={() => (openMenuId = null)} />

{#snippet matFormFields(submitLabel)}
  <div class="mat-form">
    <!-- svelte-ignore a11y_autofocus -->
    <input placeholder={'Name (e.g. 2x4, 1/2" plywood)'} bind:value={matForm.name} autofocus />
    <div class="dim-grid">
      {#each [['w', 'W'], ['h', 'H'], ['l', 'L']] as [key, label] (key)}
        <label>
          {label}
          <DimInput value={matForm[key]} min={0.01} onchange={(v) => (matForm[key] = v)} />
          <span class="fix-check" title="Fixed dimensions can't be resized on pieces">
            <input type="checkbox" bind:checked={matForm.fixed[key]} /> fixed
          </span>
        </label>
      {/each}
    </div>
    <div class="row">
      <input type="color" bind:value={matForm.color} title="Color" />
      <button class="btn primary" onclick={submitMaterial}>{submitLabel}</button>
      <button class="btn" onclick={cancelForm}>Cancel</button>
    </div>
  </div>
{/snippet}

<aside>
  <section>
    <h3>Materials</h3>
    {#each plan.materials as m (m.id)}
      {#if editingId === m.id}
        {@render matFormFields('Save')}
      {:else}
        <div class="mat-row">
          <span class="swatch" style="background: {m.color}"></span>
          <div class="mat-info">
            <div class="mat-name">{m.name}</div>
            <div class="mat-dims">{sizeText(m)}</div>
          </div>
          <button class="btn" onclick={() => addPiece(m.id)} title="Add a piece of this material">
            <Plus size={13} /> add
          </button>
          <div class="menu-wrap">
            <button
              class="menu-btn"
              onclick={(e) => {
                e.stopPropagation();
                openMenuId = openMenuId === m.id ? null : m.id;
              }}
              title="Material actions"
            >
              <Ellipsis size={15} />
            </button>
            {#if openMenuId === m.id}
              <div class="menu">
                <button onclick={() => startEdit(m)}>
                  <Pencil size={13} /> Edit
                </button>
                <button
                  class="danger"
                  onclick={() => {
                    openMenuId = null;
                    confirmRemoveMaterial(m);
                  }}
                >
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    {/each}
    {#if showMatForm}
      {@render matFormFields('Add material')}
    {:else if editingId == null}
      <button class="btn wide" onclick={openNewForm}>
        <Plus size={14} /> New material…
      </button>
    {/if}
  </section>

  <section>
    <div class="sec-head">
      <h3>Cut list</h3>
      <label class="grouped-toggle" title="Group identical sizes into one row">
        <input type="checkbox" bind:checked={plan.cutListGrouped} />
        Grouped
      </label>
    </div>
    <CutList />
  </section>
</aside>

<style>
  aside {
    width: 320px;
    flex-shrink: 0;
    overflow-y: auto;
    background: #fafbfc;
    border-right: 1px solid #e2e5e9;
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

  .sec-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .sec-head h3 {
    margin: 0;
  }

  .grouped-toggle {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: #4b5563;
    cursor: pointer;
  }

  .grouped-toggle input {
    margin: 0;
  }

  .mat-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 0;
  }

  .mat-info {
    flex: 1;
    min-width: 0;
  }

  .mat-name {
    font-weight: 600;
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mat-dims {
    font-size: 11.5px;
    color: #6b7280;
    font-variant-numeric: tabular-nums;
  }

  .menu-wrap {
    position: relative;
  }

  .menu-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: none;
    color: #6b7280;
    cursor: pointer;
  }

  .menu-btn:hover {
    background: #e2e6ea;
    color: #111827;
  }

  .menu {
    position: absolute;
    right: 0;
    top: calc(100% + 2px);
    z-index: 10;
    min-width: 110px;
    padding: 4px;
    background: #fff;
    border: 1px solid #d3d8de;
    border-radius: 8px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
  }

  .menu button {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    padding: 6px 8px;
    border: none;
    border-radius: 5px;
    background: none;
    font: inherit;
    font-size: 12.5px;
    color: #374151;
    text-align: left;
    cursor: pointer;
  }

  .menu button:hover {
    background: #eef1f4;
  }

  .menu button.danger {
    color: #b91c1c;
  }

  .menu button.danger:hover {
    background: #fceaea;
  }

  .mat-form {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .mat-form input[type='color'] {
    width: 36px;
    height: 30px;
    padding: 2px;
    border: 1px solid #d3d8de;
    border-radius: 6px;
    background: #fff;
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

  .fix-check {
    display: flex;
    align-items: center;
    gap: 4px;
    font-weight: 400;
  }

  .fix-check input {
    margin: 0;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
  }

  .wide {
    width: 100%;
    margin-top: 8px;
  }
</style>
