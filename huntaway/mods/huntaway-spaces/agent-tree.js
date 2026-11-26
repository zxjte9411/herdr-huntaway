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
