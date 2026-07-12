<script>
  import { plan } from './state.svelte.js';
  import { formatLen } from './units.js';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import Printer from '@lucide/svelte/icons/printer';

  let { material, stock, onclose } = $props();

  const isBoard = $derived(stock.unit === 'board');
  const unitName = $derived(isBoard ? 'Board' : 'Sheet');

  function label(r) {
    return isBoard
      ? formatLen(r.w, plan.units)
      : `${formatLen(r.w, plan.units)} × ${formatLen(r.h, plan.units)}`;
  }

  // Font size in viewBox units (inches): fit across the rect's short side and
  // along its long side, capped relative to the stock size.
  function fontSize(r) {
    const along = Math.max(r.w, r.h);
    const across = Math.min(r.w, r.h);
    return Math.min(
      across * 0.6,
      (along * 1.7) / label(r).length,
      Math.max(stock.binW, stock.binH) / 14
    );
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="diagram">
  <header>
    <button class="btn no-print" onclick={onclose} title="Back to plan (Esc)">
      <ArrowLeft size={14} /> Back
    </button>
    <span class="swatch" style="background: {material.color}"></span>
    <h2>{material.name}</h2>
    <span class="sub">
      buy {stock.count}
      {stock.unit}{stock.count === 1 ? '' : 's'} ·
      {formatLen(stock.binW, plan.units)} × {formatLen(stock.binH, plan.units)} stock
      {#if plan.quantity > 1}
        · for {plan.quantity} builds
      {/if}
    </span>
    <button class="btn no-print" onclick={() => window.print()} title="Print cut diagram">
      <Printer size={14} /> Print
    </button>
  </header>
  <div class="bins">
    {#each stock.bins as bin, i (i)}
      <figure class:board={isBoard}>
        <figcaption>{unitName} {i + 1}</figcaption>
        <svg viewBox="-1 -1 {stock.binW + 2} {stock.binH + 2}">
          <rect class="stock" x="0" y="0" width={stock.binW} height={stock.binH} />
          {#each bin.cuts as c (c)}
            <line class="kerf" x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} />
          {/each}
          {#each bin.rects as r (r)}
            <rect class="cut" x={r.x} y={r.y} width={r.w} height={r.h} fill={material.color} />
            <text
              x={r.x + r.w / 2}
              y={r.y + r.h / 2}
              font-size={fontSize(r)}
              transform={r.h > r.w ? `rotate(-90 ${r.x + r.w / 2} ${r.y + r.h / 2})` : undefined}
            >
              {label(r)}
            </text>
          {/each}
        </svg>
      </figure>
    {/each}
    {#if stock.unplacedSizes.length}
      <p class="nofit">
        Too big for one {stock.unit}:
        {stock.unplacedSizes.map(label).join(', ')}
      </p>
    {/if}
  </div>
  <footer>
    Guillotine layout — every cut runs edge to edge, and same-size pieces share cut lines where
    possible. Dotted lines show cuts continuing through waste. Cuts include a 1/8" kerf.
  </footer>
</div>

<style>
  .diagram {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #fff;
  }

  header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    border-bottom: 1px solid #e2e5e9;
  }

  h2 {
    margin: 0;
    font-size: 15px;
    color: #111827;
  }

  .sub {
    flex: 1;
    font-size: 12.5px;
    color: #6b7280;
    font-variant-numeric: tabular-nums;
  }

  .bins {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    align-content: flex-start;
    gap: 20px;
    padding: 20px;
    overflow-y: auto;
  }

  figure {
    width: 230px;
    margin: 0;
    break-inside: avoid;
  }

  figure.board {
    width: 100%;
    max-width: 900px;
  }

  figcaption {
    margin-bottom: 4px;
    font-size: 12px;
    color: #6b7280;
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .stock {
    fill: #f3f4f6;
    stroke: #9ca3af;
    stroke-width: 1px;
    vector-effect: non-scaling-stroke;
  }

  .cut {
    stroke: rgba(0, 0, 0, 0.4);
    stroke-width: 1px;
    vector-effect: non-scaling-stroke;
  }

  .kerf {
    stroke: #9ca3af;
    stroke-width: 1px;
    stroke-dasharray: 4 3;
    vector-effect: non-scaling-stroke;
  }

  text {
    fill: #1f2937;
    text-anchor: middle;
    dominant-baseline: middle;
    font-family: inherit;
    font-variant-numeric: tabular-nums;
  }

  .nofit {
    width: 100%;
    margin: 0;
    font-size: 12.5px;
    color: #dc2626;
  }

  footer {
    padding: 8px 16px;
    border-top: 1px solid #e9ecef;
    font-size: 11.5px;
    color: #6b7280;
  }

  /* The diagram is the only visible layout when open, so printing just works:
     let it flow across pages and drop the buttons. */
  @media print {
    .diagram {
      height: auto;
    }

    .bins {
      overflow: visible;
    }

    .no-print {
      display: none;
    }
  }
</style>
