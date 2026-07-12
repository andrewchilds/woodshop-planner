<script>
  import { plan, togglePieceHidden } from './state.svelte.js';
  import { formatLen } from './units.js';
  import { stockNeeded } from './stock.js';
  import Eye from '@lucide/svelte/icons/eye';
  import EyeOff from '@lucide/svelte/icons/eye-off';

  const groups = $derived.by(() => {
    const out = [];
    for (const m of plan.materials) {
      const sizes = new Map();
      for (const p of plan.pieces) {
        if (p.materialId !== m.id) continue;
        const key = `${p.h}|${p.w}|${p.l}`;
        if (!sizes.has(key)) sizes.set(key, { key, w: p.w, h: p.h, l: p.l, ids: [] });
        sizes.get(key).ids.push(p.id);
      }
      if (sizes.size) {
        out.push({
          material: m,
          sizes: [...sizes.values()].sort((a, b) => b.l - a.l || b.w - a.w || b.h - a.h),
        });
      }
    }
    return out;
  });

  // Ungrouped: one row per piece, still bucketed by material, largest first.
  const flat = $derived.by(() => {
    const out = [];
    for (const m of plan.materials) {
      const pieces = plan.pieces
        .filter((p) => p.materialId === m.id)
        .toSorted((a, b) => b.l - a.l || b.w - a.w || b.h - a.h);
      if (pieces.length) out.push({ material: m, pieces });
    }
    return out;
  });

  // Stock purchase estimate per material id.
  const needs = $derived.by(() => {
    const map = new Map();
    for (const m of plan.materials) {
      const n = stockNeeded(m, plan.pieces.filter((p) => p.materialId === m.id));
      if (n) map.set(m.id, n);
    }
    return map;
  });

  // Clicking a row selects the pieces of that size in turn.
  function cycle(ids) {
    const i = ids.indexOf(plan.selectedId);
    plan.selectedId = ids[(i + 1) % ids.length];
  }
</script>

{#snippet header(m)}
  {@const n = needs.get(m.id)}
  <h4>
    <span class="swatch" style="background: {m.color}"></span>
    <span class="mat-name">{m.name}</span>
    {#if n}
      {#if n.unit === 'item'}
        <span class="buy">{n.count} item{n.count === 1 ? '' : 's'}</span>
      {:else}
        <button class="buy link" onclick={() => (plan.cutDiagramId = m.id)} title="Show cut diagram">
          {#if n.count > 0}
            {n.count} {n.unit}{n.count === 1 ? '' : 's'}
          {/if}
          {#if n.unplaced > 0}
            <span
              class="nofit"
              title="{n.unplaced} piece{n.unplaced > 1 ? 's are' : ' is'} too big to cut from one {m.name}"
            >
              {n.unplaced} won't fit
            </span>
          {/if}
        </button>
      {/if}
    {/if}
  </h4>
{/snippet}

{#snippet dims(p, fx)}
  <span>
    <span class:fixed={fx.has('h')}>{formatLen(p.h, plan.units)}</span>
    <span class="fixed">×</span>
    <span class:fixed={fx.has('w')}>{formatLen(p.w, plan.units)}</span>
    <span class="fixed">×</span>
    <span class:fixed={fx.has('l')}>{formatLen(p.l, plan.units)}</span>
  </span>
{/snippet}

{#if groups.length === 0}
  <p class="hint">No pieces yet.</p>
{:else if plan.cutListGrouped}
  {#each groups as g (g.material.id)}
    {@const fx = new Set(g.material.fixed ?? [])}
    <div class="group">
      {@render header(g.material)}
      {#each g.sizes as s (s.key)}
        <button
          class="cutrow"
          class:sel={s.ids.includes(plan.selectedId)}
          onclick={() => cycle(s.ids)}
          title="Click to select each piece of this size in turn"
        >
          <span class="qty">{s.ids.length}×</span>
          {@render dims(s, fx)}
        </button>
      {/each}
    </div>
  {/each}
{:else}
  {#each flat as g (g.material.id)}
    {@const fx = new Set(g.material.fixed ?? [])}
    <div class="group">
      {@render header(g.material)}
      {#each g.pieces as p (p.id)}
        {@const hidden = plan.hiddenIds.includes(p.id)}
        <div class="piece-row" class:off={hidden}>
          <button
            class="eye"
            onclick={() => togglePieceHidden(p.id)}
            title={hidden ? 'Show piece' : 'Hide piece'}
          >
            {#if hidden}
              <EyeOff size={14} />
            {:else}
              <Eye size={14} />
            {/if}
          </button>
          <button
            class="cutrow pick"
            class:sel={p.id === plan.selectedId}
            onclick={() => (plan.selectedId = p.id)}
            title="Click to select this piece"
          >
            {@render dims(p, fx)}
            {#if p.name}
              <span class="piece-name">{p.name}</span>
            {/if}
          </button>
        </div>
      {/each}
    </div>
  {/each}
{/if}

<style>
  .group {
    margin-bottom: 10px;
  }

  h4 {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0 0 4px;
    font-size: 13px;
  }

  .mat-name {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .buy {
    flex-shrink: 0;
    font-size: 11.5px;
    font-weight: 500;
    color: #6b7280;
    font-variant-numeric: tabular-nums;
  }

  .buy.link {
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    font-size: 11.5px;
    font-weight: 500;
    color: #2563eb;
    cursor: pointer;
  }

  .buy.link:hover {
    text-decoration: underline;
  }

  .nofit {
    color: #dc2626;
  }

  .cutrow {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 4px 8px;
    margin-bottom: 2px;
    border: 1px solid transparent;
    border-radius: 5px;
    background: none;
    font: inherit;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    color: #374151;
    text-align: left;
    cursor: pointer;
  }

  .cutrow:hover {
    background: #eef1f4;
  }

  .cutrow.sel {
    background: #e3ecfb;
    border-color: #b9cef2;
  }

  .piece-row {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-bottom: 2px;
  }

  .piece-row .pick {
    flex: 1;
    width: auto;
    margin-bottom: 0;
  }

  .piece-row.off .pick {
    color: #9ca3af;
  }

  .eye {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: none;
    color: #6b7280;
    cursor: pointer;
  }

  .eye:hover {
    background: #e2e6ea;
    color: #111827;
  }

  .piece-row.off .eye {
    color: #b6bcc4;
  }

  .fixed {
    color: #9ca3af;
  }

  .qty {
    min-width: 26px;
    font-weight: 600;
    color: #111827;
  }

  .piece-name {
    flex: 1;
    min-width: 0;
    text-align: right;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #6b7280;
    font-size: 12px;
  }
</style>
