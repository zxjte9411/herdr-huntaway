export function fitTabs(tabs, width, room, gap = 2) {
  const full = tabs.map(tab => width(tab, false));
  if (!room || full.reduce((total, value) => total + value + gap, -gap) <= room) {
    return { compact: false, overflow: false };
  }
  const compact = tabs.map(tab => width(tab, tab.active ? false : true));
  return {
    compact: true,
    overflow: compact.reduce((total, value) => total + value + gap, -gap) > room,
  };
}

export function dropMarkerIndex(from, to) {
  return from < to ? to + 1 : to;
}
