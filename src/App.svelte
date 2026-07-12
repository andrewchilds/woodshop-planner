<script>
  import Scene from './lib/Scene.svelte';
  import Sidebar from './lib/Sidebar.svelte';
  import PropertiesPanel from './lib/PropertiesPanel.svelte';
  import CutDiagram from './lib/CutDiagram.svelte';
  import Dropdown from './lib/Dropdown.svelte';
  import { stockNeeded } from './lib/stock.js';
  import Undo2 from '@lucide/svelte/icons/undo-2';
  import Redo2 from '@lucide/svelte/icons/redo-2';
  import Save from '@lucide/svelte/icons/save';
  import Check from '@lucide/svelte/icons/check';
  import Download from '@lucide/svelte/icons/download';
  import Upload from '@lucide/svelte/icons/upload';
  import {
    plan,
    projectStore,
    serialize,
    persist,
    removePiece,
    duplicatePiece,
    saveProject,
    loadProject,
    deleteProject,
    exportText,
    importText,
    history,
    recordHistory,
    undo,
    redo,
  } from './lib/state.svelte.js';

  // Autosave to localStorage and record undo history, debounced so drags
  // don't write every frame and collapse into a single undo step.
  $effect(() => {
    const json = serialize();
    const t = setTimeout(() => {
      persist(json);
      recordHistory(json);
    }, 300);
    return () => clearTimeout(t);
  });

  let fileInput;
  let savedFlash = $state(false);

  // Cut diagram takes over the whole layout; the app stays mounted but hidden
  // so the 3D scene (and its camera) survive. Closes itself if the material
  // or its pieces disappear.
  const diagram = $derived.by(() => {
    const m = plan.materials.find((m) => m.id === plan.cutDiagramId);
    if (!m) return null;
    const stock = stockNeeded(m, plan.pieces.filter((p) => p.materialId === m.id), plan.quantity);
    return stock ? { material: m, stock } : null;
  });

  function onSave() {
    saveProject();
    savedFlash = true;
    setTimeout(() => (savedFlash = false), 1200);
  }

  function onLoadSelect(name) {
    if (plan.pieces.length && !confirm(`Load "${name}" and replace the current plan?`)) return;
    loadProject(name);
  }

  function onDeleteProject(name) {
    if (!confirm(`Delete the saved project "${name}"?`)) return;
    deleteProject(name);
  }

  function exportFile() {
    const blob = new Blob([exportText()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(plan.name.trim() || 'woodshop-plan').replace(/[^\w.-]+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importFile(e) {
    const input = e.currentTarget;
    const file = input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      if (plan.pieces.length && !confirm(`Replace the current plan with "${file.name}"?`)) {
        return;
      }
      importText(text);
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    } finally {
      input.value = '';
    }
  }

  function onKeydown(e) {
    if (e.target.closest('input, select, textarea')) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && plan.selectedId != null) {
      e.preventDefault();
      removePiece(plan.selectedId);
    } else if (e.key === 'Escape') {
      plan.selectedId = null;
    } else if (e.key === 'd' && plan.selectedId != null) {
      duplicatePiece(plan.selectedId);
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if diagram}
  <CutDiagram
    material={diagram.material}
    stock={diagram.stock}
    onclose={() => (plan.cutDiagramId = null)}
  />
{/if}

<div class="app" class:hidden={diagram != null}>
  <header>
    <h1>Woodshop Planner</h1>
    <div class="proj">
      <button class="btn" onclick={undo} disabled={!history.canUndo} title="Undo (⌘Z)">
        <Undo2 size={14} />
      </button>
      <button class="btn" onclick={redo} disabled={!history.canRedo} title="Redo (⇧⌘Z)">
        <Redo2 size={14} />
      </button>
      <input class="name" placeholder="Project name" bind:value={plan.name} />
      <button class="btn" onclick={onSave}>
        {#if savedFlash}<Check size={14} /> Saved{:else}<Save size={14} /> Save{/if}
      </button>
      <Dropdown
        label="Load…"
        items={projectStore.names}
        onselect={onLoadSelect}
        ondelete={onDeleteProject}
      />
      <button class="btn" onclick={exportFile}><Download size={14} /> Export</button>
      <button class="btn" onclick={() => fileInput.click()}><Upload size={14} /> Import</button>
      <input
        type="file"
        accept=".json,.txt,application/json,text/plain"
        hidden
        bind:this={fileInput}
        onchange={importFile}
      />
    </div>
    <div class="header-controls">
      <div class="seg">
        <button
          class:active={plan.units === 'imperial'}
          onclick={() => (plan.units = 'imperial')}
        >
          in / ft
        </button>
        <button class:active={plan.units === 'metric'} onclick={() => (plan.units = 'metric')}>
          metric
        </button>
      </div>
      <div class="seg">
        <button class:active={plan.view === 'solid'} onclick={() => (plan.view = 'solid')}>
          solid
        </button>
        <button class:active={plan.view === 'xray'} onclick={() => (plan.view = 'xray')}>
          x-ray
        </button>
      </div>
      <label class="check">
        <input type="checkbox" bind:checked={plan.snap} />
        snap to grid
      </label>
    </div>
  </header>
  <div class="main">
    <Sidebar />
    <Scene />
    <PropertiesPanel />
  </div>
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .app.hidden {
    display: none;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: #ffffff;
    border-bottom: 1px solid #e2e5e9;
  }

  h1 {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: #111827;
  }

  .header-controls {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .proj {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .proj .name {
    width: 160px;
  }

  .seg {
    display: flex;
    border: 1px solid #d3d8de;
    border-radius: 6px;
    overflow: hidden;
  }

  .seg button {
    border: none;
    background: #fff;
    padding: 5px 12px;
    font: inherit;
    font-size: 12.5px;
    color: #4b5563;
    cursor: pointer;
  }

  .seg button + button {
    border-left: 1px solid #d3d8de;
  }

  .seg button.active {
    background: #2563eb;
    color: #fff;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    color: #4b5563;
    cursor: pointer;
  }

  .main {
    flex: 1;
    display: flex;
    min-height: 0;
  }
</style>
