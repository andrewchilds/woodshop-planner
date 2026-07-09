const IN_TO_MM = 25.4;

function trim(n, dp) {
  return Number(n.toFixed(dp)).toString();
}

export function unitLabel(units) {
  return units === 'metric' ? 'mm' : 'in';
}

// Value shown in an input for a stored inch value.
export function toDisplay(inches, units) {
  return units === 'metric' ? Number((inches * IN_TO_MM).toFixed(1)) : Number(inches.toFixed(3));
}

// Inches for a value typed into an input.
export function fromDisplay(value, units) {
  return units === 'metric' ? value / IN_TO_MM : value;
}

export function inputStep(units) {
  return units === 'metric' ? 1 : 0.125;
}

// Pretty-printed length: fractional inches (nearest 1/16) or mm/m.
export function formatLen(inches, units) {
  if (units === 'metric') {
    const mm = inches * IN_TO_MM;
    return mm >= 1000 ? `${trim(mm / 1000, 2)} m` : `${trim(mm, 1)} mm`;
  }
  const sixteenths = Math.round(inches * 16);
  const sign = sixteenths < 0 ? '-' : '';
  const abs = Math.abs(sixteenths);
  const whole = Math.floor(abs / 16);
  let num = abs % 16;
  let den = 16;
  while (num && num % 2 === 0) {
    num /= 2;
    den /= 2;
  }
  if (!num) return `${sign}${whole}"`;
  if (!whole) return `${sign}${num}/${den}"`;
  return `${sign}${whole} ${num}/${den}"`;
}
