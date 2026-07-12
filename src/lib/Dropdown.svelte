<script>
  // A button that opens a menu of string items. Selecting an item calls
  // onselect(item); the trash button on each row calls ondelete(item) and
  // keeps the menu open so several items can be deleted in a row.
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Trash2 from '@lucide/svelte/icons/trash-2';

  let { label, items, onselect, ondelete } = $props();
  let open = $state(false);
</script>

<svelte:window
  onclick={() => (open = false)}
  onkeydown={(e) => e.key === 'Escape' && (open = false)}
/>

<div class="dropdown">
  <button
    class="btn"
    disabled={!items.length}
    onclick={(e) => {
      e.stopPropagation();
      open = !open;
    }}
  >
    {label}
    <ChevronDown size={13} />
  </button>
  {#if open && items.length}
    <div class="menu">
      {#each items as item (item)}
        <div class="item">
          <button
            class="pick"
            onclick={() => {
              open = false;
              onselect(item);
            }}
          >
            {item}
          </button>
          <button
            class="del"
            title="Delete “{item}”"
            onclick={(e) => {
              e.stopPropagation();
              ondelete(item);
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .dropdown {
    position: relative;
  }

  .menu {
    position: absolute;
    left: 0;
    top: calc(100% + 2px);
    z-index: 10;
    min-width: 180px;
    max-height: 60vh;
    overflow-y: auto;
    padding: 4px;
    background: #fff;
    border: 1px solid #d3d8de;
    border-radius: 8px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
  }

  .item {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .item button {
    border: none;
    border-radius: 5px;
    background: none;
    font: inherit;
    cursor: pointer;
  }

  .pick {
    flex: 1;
    min-width: 0;
    padding: 6px 8px;
    font-size: 12.5px;
    color: #374151;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pick:hover {
    background: #eef1f4;
  }

  .del {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 26px;
    height: 26px;
    padding: 0;
    color: #6b7280;
  }

  .del:hover {
    background: #fceaea;
    color: #b91c1c;
  }
</style>
