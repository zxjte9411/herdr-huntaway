// Build only trees reachable from listed agents; raw terminal children must themselves be agents.
export function agentTreeBySpace(agentList, terminalList) {
  const listed = new Map();
  for (const agent of agentList) if (agent.address && !listed.has(agent.address)) listed.set(agent.address, agent);
  const terminalByAddress = new Map();
  for (const terminal of terminalList) {
    if (terminal.address && !terminalByAddress.has(terminal.address)) terminalByAddress.set(terminal.address, terminal);
  }
  const children = new Map();
  for (const terminal of terminalByAddress.values()) {
    if (terminal.state !== "live" || !terminal.parent || (!listed.has(terminal.address) && terminal.program?.agent !== true)) continue;
    if (!children.has(terminal.parent)) children.set(terminal.parent, []);
    children.get(terminal.parent).push(terminal);
  }
  const order = (a, b) => (a.tab_index ?? 0) - (b.tab_index ?? 0) || (a.seq ?? 0) - (b.seq ?? 0);
  const ordered = [...listed.values()].sort(order);
  const hasListedAncestor = agent => {
    let terminal = terminalByAddress.get(agent.address);
    const walked = new Set([agent.address]);
    while (terminal?.state === "live" && terminal.parent) {
      const parent = terminal.parent;
      if (walked.has(parent)) return false;
      walked.add(parent);
      const parentAgent = listed.get(parent);
      if (parentAgent) return parentAgent.space === agent.space;
      terminal = terminalByAddress.get(parent);
      if (terminal?.state !== "live" || terminal.program?.agent !== true
        || (terminal.space != null && terminal.space !== agent.space)) return false;
    }
    return false;
  };
  // Choose roots from relationships before render order can claim a child first.
  const roots = ordered.filter(agent => !hasListedAncestor(agent));
  const bySpace = new Map();
  const seen = new Set();

  const build = (agent, space) => {
    if (seen.has(agent.address)) return null;
    seen.add(agent.address);
    const node = { agent, children: [] };
    for (const terminal of children.get(agent.address) ?? []) {
      const child = listed.get(terminal.address) ?? {
        ...terminal,
        space,
        status: terminal.status === "error" ? "blocked" : terminal.status === "done" ? "idle" : terminal.status,
        program: terminal.program,
        pane: null,
      };
      if (child.space !== space || seen.has(child.address)) continue;
      const nested = build(child, space);
      if (nested) node.children.push(nested);
    }
    return node;
  };

  for (const agent of [...roots, ...ordered]) {
    if (seen.has(agent.address)) continue;
    if (!bySpace.has(agent.space)) bySpace.set(agent.space, []);
    const root = build(agent, agent.space);
    if (root) bySpace.get(agent.space).push(root);
  }
  return bySpace;
}

// Keep parent/child groups intact; only reorder roots within their own space.
export function reorderAgentRoots(nodes, addresses) {
  const rank = new Map(addresses.map((address, index) => [address, index]));
  return [...nodes].sort((a, b) =>
    (rank.get(a.agent.address) ?? Infinity) - (rank.get(b.agent.address) ?? Infinity));
}

// Keep roots from one tab together; children remain attached to their root.
export function groupAgentRootsByTab(nodes, addresses) {
  const ordered = reorderAgentRoots(nodes, addresses);
  const slots = ordered.map((n, index) => typeof n.agent.tab === "string" && n.agent.tab ? index : -1)
    .filter(index => index >= 0);
  const tabs = [...new Set(slots.map(index => ordered[index].agent.tab))];
  const rank = new Map(tabs.map((tab, index) => [tab, index]));
  const grouped = slots.map(index => ordered[index]).sort((a, b) =>
    rank.get(a.agent.tab) - rank.get(b.agent.tab));
  const result = [...ordered];
  slots.forEach((slot, index) => { result[slot] = grouped[index]; });
  return result;
}

export function orderAgentRootsByTabs(nodes, tabs, addresses) {
  const ordered = reorderAgentRoots(nodes, addresses);
  const rank = new Map(tabs.map((tab, index) => [tab.id, index]));
  const slots = ordered.map((n, index) => rank.has(n.agent.tab) ? index : -1).filter(index => index >= 0);
  const byTab = slots.map(index => ordered[index]).sort((a, b) =>
    rank.get(a.agent.tab) - rank.get(b.agent.tab));
  const result = [...ordered];
  slots.forEach((slot, index) => { result[slot] = byTab[index]; });
  return result;
}

// Reorder only the slots already occupied by agent tabs; ordinary tabs stay put.
export function tabsWithAgentOrder(tabs, agentTabIds) {
  const order = new Map(agentTabIds.map((id, index) => [id, index]));
  const slots = tabs.map((tab, index) => order.has(tab.id) ? index : -1).filter(index => index >= 0);
  const agents = slots.map(index => tabs[index]).sort((a, b) =>
    order.get(a.id) - order.get(b.id));
  const result = [...tabs];
  slots.forEach((slot, index) => { result[slot] = agents[index]; });
  return result;
}

// `tab.move` inserts rather than swaps. Simulate moves so the final order is exact.
export function tabMovePlan(tabs, target) {
  return tabMoveSteps(tabs, target).map(step => step.move);
}

function tabMoveSteps(tabs, target) {
  const current = tabs.map(tab => tab.id);
  const wanted = target.map(tab => typeof tab === "string" ? tab : tab.id);
  const steps = [];
  for (let index = 0; index < wanted.length; index++) {
    if (current[index] === wanted[index]) continue;
    const from = current.indexOf(wanted[index]);
    if (from < 0) continue;
    const move = { id: wanted[index], index: index + 1 };
    current.splice(index, 0, current.splice(from, 1)[0]);
    steps.push({ move, expected: [...current] });
  }
  return steps;
}

function retainUnresolvedOrder(order, previous) {
  const live = new Set(order);
  const result = previous.map(address => live.has(address) ? order.shift() : address);
  return [...result, ...order];
}

export function tabGestureApplied(tabs, gesture) {
  const from = tabs.findIndex(tab => tab.id === gesture?.tab);
  const to = tabs.findIndex(tab => tab.id === gesture?.target);
  return from >= 0 && to >= 0 && (gesture.after ? from > to : from < to);
}

export function resumeAfterTabGesture(tabs, spaceId, state, gesture) {
  return gesture?.space === spaceId && tabGestureApplied(tabs, gesture)
    ? { initialized: true }
    : state;
}

// The saved sidebar order owns the first complete sync; while moves echo back,
// never mistake an intermediate tab snapshot for a new user order.
export const AGENT_TAB_SYNC_TIMEOUT = 5000;

export function agentTabSyncNeedsWake(state, now = Date.now()) {
  return Boolean(state?.pending && now - state.pending.startedAt >= AGENT_TAB_SYNC_TIMEOUT);
}

export function syncAgentTabOrder(tabs, nodes, addresses, state = {}, now = Date.now()) {
  if (state.aborted) return { state, addresses, moves: [], waiting: false, aborted: true };
  if (!nodes.length) {
    return state.pending
      ? { state: { initialized: false, aborted: true }, addresses, moves: [], waiting: false, aborted: true }
      : { state, addresses, moves: [], waiting: true };
  }
  const tabIds = new Set(tabs.map(tab => tab.id));
  if (nodes.some(({ agent }) => typeof agent.tab === "string" && agent.tab && !tabIds.has(agent.tab))) {
    if (!state.pending) return { state, addresses, moves: [], waiting: true };
  }
  const ids = tabs.map(tab => tab.id);
  if (state.pending) {
    if (ids.some((id, index) => id !== state.pending.expected[index]) || ids.length !== state.pending.expected.length) {
      const signature = JSON.stringify(ids);
      if (now - state.pending.startedAt >= AGENT_TAB_SYNC_TIMEOUT) {
        return {
          state: { initialized: false, aborted: true, lastSnapshot: signature },
          addresses,
          moves: [],
          waiting: false,
          aborted: true,
        };
      }
      if (signature === state.pending.lastMismatch) return { state, addresses, moves: [], waiting: true };
      const mismatches = (state.pending.mismatches ?? 0) + 1;
      if (mismatches >= 3) {
        return {
          state: { initialized: false, aborted: true, lastSnapshot: signature },
          addresses,
          moves: [],
          waiting: false,
          aborted: true,
        };
      }
      return {
        state: { ...state, pending: { ...state.pending, mismatches, lastMismatch: signature } },
        addresses,
        moves: [],
        waiting: true,
      };
    }
    const next = state.pending.next;
    if (next < state.pending.steps.length) {
      return {
        state: { initialized: false, pending: { ...state.pending, next: next + 1, expected: state.pending.steps[next].expected, startedAt: now, mismatches: 0, lastMismatch: null } },
        addresses,
        moves: [state.pending.steps[next].move],
        waiting: true,
      };
    }
    state = { initialized: true };
  }
  if (!state.initialized) {
    const ordered = groupAgentRootsByTab(nodes, addresses);
    const target = tabsWithAgentOrder(tabs, [...new Set(ordered
      .map(node => node.agent.tab)
      .filter(tab => typeof tab === "string" && tab))]);
    const steps = tabMoveSteps(tabs, target);
    const nextAddresses = retainUnresolvedOrder(
      ordered.map(node => node.agent.address),
      addresses,
    );
    const next = steps.length
      ? { initialized: false, pending: { steps, next: 1, expected: steps[0].expected, startedAt: now, mismatches: 0, lastMismatch: null } }
      : { initialized: true };
    return { state: next, addresses: nextAddresses, moves: steps.length ? [steps[0].move] : [], waiting: steps.length > 0 };
  }
  const ordered = orderAgentRootsByTabs(nodes, tabs, addresses).map(node => node.agent.address);
  return {
    state,
    addresses: retainUnresolvedOrder(ordered, addresses),
    moves: [],
    waiting: false,
  };
}
