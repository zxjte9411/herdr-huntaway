export function wheelInput(event, axis) {
  const lines = event.delta_lines?.[axis];
  return lines
    ? { delta: lines, threshold: 4 }
    : { delta: event.delta[axis], threshold: 48 };
}

export function wheelSteps(delta, remainder, threshold) {
  const total = remainder + delta;
  const steps = Math.trunc(total / threshold);
  return { steps, remainder: total - steps * threshold };
}

export function nextScrollIndex(widths, offset, viewport, direction, count = 1, gap = 2, inset = 3) {
  const candidates = [];
  let start = inset;
  for (let i = 0; i < widths.length; i++) {
    const end = start + widths[i];
    if (direction > 0 ? start >= offset + viewport : end <= offset) candidates.push(i);
    start = end + gap;
  }
  if (direction < 0) candidates.reverse();
  return candidates[count - 1] ?? null;
}
