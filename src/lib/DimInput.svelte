<script>
  import { plan } from './state.svelte.js';
  import { toDisplay, fromDisplay, inputStep } from './units.js';

  let { value, onchange, min = null, disabled = false, title = null } = $props();

  // Shift+arrow steps by a whole unit (1" or 10 mm), preserving any decimal
  // part: 3.5 goes to 4.5, then 5.5.
  function onKeydown(e) {
    if (!e.shiftKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const big = plan.units === 'metric' ? 10 : 1;
    const typed = parseFloat(e.currentTarget.value);
    const base = Number.isNaN(typed) ? toDisplay(value, plan.units) : typed;
    const next = base + (e.key === 'ArrowUp' ? big : -big);
    let v = fromDisplay(next, plan.units);
    if (min !== null && v < min) v = min;
    onchange(v);
  }
</script>

<input
  type="number"
  step={inputStep(plan.units)}
  {disabled}
  {title}
  value={toDisplay(value, plan.units)}
  onkeydown={onKeydown}
  onchange={(e) => {
    const raw = parseFloat(e.currentTarget.value);
    if (Number.isNaN(raw)) {
      e.currentTarget.value = toDisplay(value, plan.units);
      return;
    }
    let v = fromDisplay(raw, plan.units);
    if (min !== null && v < min) v = min;
    onchange(v);
  }}
/>
