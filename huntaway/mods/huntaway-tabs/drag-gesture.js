export function tabDragGesture(space, sourceId, targetId, revision) {
  const tabs = space?.tabs ?? [];
  const source = tabs.findIndex(tab => tab.id === sourceId);
  const target = tabs.findIndex(tab => tab.id === targetId);
  if (source < 0 || target < 0 || source === target) return null;
  return { space: space.id, tab: sourceId, target: targetId, after: source < target, revision };
}
