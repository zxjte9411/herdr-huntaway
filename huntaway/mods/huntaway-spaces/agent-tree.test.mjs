import assert from "node:assert/strict";
import { agentTreeBySpace, reorderAgentRoots, groupAgentRootsByTab, orderAgentRootsByTabs, tabsWithAgentOrder, tabMovePlan, syncAgentTabOrder, tabGestureApplied, resumeAfterTabGesture, agentTabSyncNeedsWake } from "./agent-tree.js";

const agents = [
  { address: "root", space: "one", tab_index: 0, seq: 1, pane: "p-root" },
  { address: "child-after-hidden-parent", space: "one", tab_index: 1, seq: 2, pane: "p-hidden-child" },
  { address: "listed-child", space: "one", tab_index: 2, seq: 3, pane: "p-child" },
  { address: "cross-child", space: "two", tab_index: 0, seq: 4, pane: "p-cross" },
  { address: "orphan", space: "one", tab_index: 3, seq: 5, pane: "p-orphan" },
  { address: "cycle-a", space: "one", tab_index: 4, seq: 6, pane: "p-a" },
  { address: "cycle-b", space: "one", tab_index: 5, seq: 7, pane: "p-b" },
  { address: "late-parent", space: "one", tab_index: 9, seq: 9, pane: "p-late-parent" },
  { address: "early-child", space: "one", tab_index: 0, seq: 0, pane: "p-early-child" },
];
const terminals = [
  { address: "root", state: "live" },
  { address: "late-parent", state: "live" },
  { address: "early-child", parent: "late-parent", state: "live", program: { agent: true } },
  { address: "hidden-parent", parent: "root", state: "live", program: { agent: false } },
  { address: "child-after-hidden-parent", parent: "hidden-parent", state: "live", program: { agent: true } },
  { address: "terminal-only-parent", parent: "root", state: "live", program: { agent: false }, status: "done" },
  { address: "listed-child", parent: "terminal-only-parent", state: "live", program: { agent: true } },
  { address: "grandchild", parent: "listed-child", state: "live", program: { agent: true }, status: "working" },
  { address: "ordinary-shell", parent: "root", state: "live", program: { agent: false } },
  { address: "cross-child", parent: "root", state: "live", program: { agent: true } },
  { address: "orphan", parent: "missing-parent", state: "live", program: { agent: true } },
  { address: "cycle-a", parent: "cycle-b", state: "live", program: { agent: true } },
  { address: "cycle-b", parent: "cycle-a", state: "live", program: { agent: true } },
  { address: "dead-child", parent: "root", state: "exited", program: { agent: true } },
];

const tree = agentTreeBySpace(agents, terminals);
const addresses = nodes => nodes.flatMap(({ agent, children }) => [agent.address, ...addresses(children)]);
assert.deepEqual(tree.get("one").map(node => node.agent.address), ["root", "child-after-hidden-parent", "listed-child", "orphan", "late-parent", "cycle-a"]);
assert.deepEqual(tree.get("two").map(node => node.agent.address), ["cross-child"]);
assert.deepEqual(tree.get("one")[0].children, []);
assert.deepEqual(tree.get("one")[2].children.map(node => node.agent.address), ["grandchild"]);
assert.equal(tree.get("one")[2].agent.pane, "p-child");
assert.equal(tree.get("one")[2].children[0].agent.status, "working");
assert.deepEqual(tree.get("one").find(node => node.agent.address === "late-parent").children.map(node => node.agent.address), ["early-child"]);
assert(!addresses(tree.get("one")).includes("ordinary-shell"));
assert(!addresses(tree.get("one")).includes("dead-child"));
assert(!addresses(tree.get("one")).includes("cross-child"));
assert.equal(new Set([...addresses(tree.get("one")), ...addresses(tree.get("two"))]).size, 10);
const roots = tree.get("one");
assert.deepEqual(reorderAgentRoots(roots, ["late-parent", "root"]).map(n => n.agent.address),
  ["late-parent", "root", "child-after-hidden-parent", "listed-child", "orphan", "cycle-a"]);
assert.deepEqual(roots.map(n => n.agent.address), ["root", "child-after-hidden-parent", "listed-child", "orphan", "late-parent", "cycle-a"]);
const grouped = groupAgentRootsByTab([
  { agent: { address: "a", tab: "one" }, children: [] },
  { agent: { address: "b", tab: "two" }, children: [] },
  { agent: { address: "c", tab: "one" }, children: [] },
], ["a", "b", "c"]);
assert.deepEqual(grouped.map(n => n.agent.address), ["a", "c", "b"]);
assert.deepEqual(orderAgentRootsByTabs(grouped, [{ id: "two" }, { id: "one" }], ["a", "c", "b"]).map(n => n.agent.address),
  ["b", "a", "c"]);
const tabs = [{ id: "a" }, { id: "ordinary" }, { id: "b" }, { id: "c" }];
const target = tabsWithAgentOrder(tabs, ["b", "a", "c"]);
assert.deepEqual(target.map(tab => tab.id), ["b", "ordinary", "a", "c"]);
assert.deepEqual(tabMovePlan(tabs, target).map(move => move.id), ["b", "ordinary"]);
const applyMove = (list, move) => {
  const result = [...list], from = result.findIndex(tab => tab.id === move.id);
  result.splice(move.index - 1, 0, result.splice(from, 1)[0]); // tab.move index is 1-based.
  return result;
};
const row = (address, tab) => ({ agent: { address, tab }, children: [] });
const rootsAB = [row("a", "a-tab"), row("b", "b-tab")];
let syncState = {};
const agentTabs = [{ id: "a-tab" }, { id: "ordinary" }, { id: "b-tab" }];
let sync = syncAgentTabOrder(agentTabs, [], ["b", "a"], syncState, 100);
assert.equal(sync.waiting, true);
assert.deepEqual(sync.state, {});
sync = syncAgentTabOrder(agentTabs, rootsAB, ["b", "a"], sync.state, 100);
assert.deepEqual(sync.addresses, ["b", "a"]);
assert.deepEqual(sync.moves, [{ id: "b-tab", index: 1 }]);
const delayedTabs = syncAgentTabOrder(agentTabs.filter(tab => tab.id !== "b-tab"), rootsAB, ["b", "a"], {});
assert.equal(delayedTabs.waiting, true);
assert.deepEqual(delayedTabs.moves, []);
syncState = sync.state;
const firstMove = sync.moves[0];
let snapshot = applyMove(agentTabs, firstMove);
assert.deepEqual(snapshot.map(tab => tab.id), ["b-tab", "a-tab", "ordinary"]); // An ordinary tab may shift temporarily.
sync = syncAgentTabOrder(snapshot, rootsAB, ["b", "a"], syncState, 200);
assert.equal(sync.waiting, true); // Do not read a partial echo as a tab drag.
assert.deepEqual(sync.addresses, ["b", "a"]);
assert.deepEqual(sync.moves, [{ id: "ordinary", index: 2 }]);
const divergent = syncAgentTabOrder(agentTabs, rootsAB, ["b", "a"], sync.state, 300);
assert.equal(divergent.waiting, true); // A conflicting snapshot cannot overwrite the saved sidebar order.
assert.deepEqual(divergent.addresses, ["b", "a"]);
const added = syncAgentTabOrder([...agentTabs, { id: "external" }], rootsAB, ["b", "a"], divergent.state, 400);
assert.equal(added.waiting, true);
const closed = syncAgentTabOrder(agentTabs.slice(0, 2), rootsAB, ["b", "a"], added.state, 500);
assert.equal(closed.aborted, true); // Repeated collection changes are bounded too.
const timedOut = syncAgentTabOrder(agentTabs, rootsAB, ["b", "a"], divergent.state, 5201);
assert.equal(timedOut.aborted, true);
assert.deepEqual(timedOut.addresses, ["b", "a"]);
assert.equal(agentTabSyncNeedsWake(divergent.state, 5199), false);
assert.equal(agentTabSyncNeedsWake(divergent.state, 5200), true);
const emptyDuringMove = syncAgentTabOrder(agentTabs, [], ["b", "a"], syncState, 200);
assert.equal(emptyDuringMove.aborted, true);
const sidebarRestart = syncAgentTabOrder(agentTabs, rootsAB, ["b", "a"], {}, 5300);
assert.deepEqual(sidebarRestart.moves, [{ id: "b-tab", index: 1 }]);
snapshot = applyMove(snapshot, sync.moves[0]);
sync = syncAgentTabOrder(snapshot, rootsAB, ["b", "a"], sync.state, 300);
assert.equal(sync.state.initialized, true);
assert.deepEqual(sync.addresses, ["b", "a"]);
const dragged = [{ id: "a-tab" }, { id: "ordinary" }, { id: "b-tab" }, { id: "c-tab" }];
const rootsABC = [...rootsAB, row("c", "c-tab")];
sync = syncAgentTabOrder(dragged, rootsABC, ["b", "a"], sync.state);
assert.deepEqual(sync.addresses, ["a", "b", "c"]); // Top-tab drag; arrival follows tab order.
assert.equal(tabGestureApplied([{ id: "b-tab" }, { id: "a-tab" }], { tab: "a-tab", target: "b-tab", after: true }), true);
assert.equal(tabGestureApplied(dragged, { tab: "a-tab", target: "b-tab", after: true }), false);
assert.deepEqual(resumeAfterTabGesture([{ id: "b-tab" }, { id: "a-tab" }], "space", timedOut.state,
  { space: "space", tab: "a-tab", target: "b-tab", after: true }), { initialized: true });
assert.deepEqual(resumeAfterTabGesture(dragged, "space", timedOut.state,
  { space: "space", tab: "a-tab", target: "b-tab", after: true }), timedOut.state);
const resumedByTopDrag = resumeAfterTabGesture([{ id: "b-tab" }, { id: "a-tab" }], "space", timedOut.state,
  { space: "space", tab: "a-tab", target: "b-tab", after: true });
assert.deepEqual(syncAgentTabOrder([{ id: "b-tab" }, { id: "a-tab" }], rootsAB, ["b", "a"], resumedByTopDrag).addresses,
  ["b", "a"]);
sync = syncAgentTabOrder(dragged, [rootsABC[0], rootsABC[2]], sync.addresses, sync.state);
assert.deepEqual(sync.addresses, ["a", "b", "c"]); // Missing agents remain unresolved, not destructively erased.
assert.deepEqual(orderAgentRootsByTabs([rootsABC[0], rootsABC[2]], dragged, sync.addresses).map(n => n.agent.address),
  ["a", "c"]);
const nullTabRoots = [row("a", "a-tab"), row("unmapped", null), row("b", "b-tab")];
assert.deepEqual(groupAgentRootsByTab(nullTabRoots, ["b", "a", "unmapped"]).map(n => n.agent.address),
  ["b", "a", "unmapped"]);
assert.deepEqual(orderAgentRootsByTabs(nullTabRoots, [{ id: "b-tab" }, { id: "a-tab" }], ["a", "unmapped", "b"])
  .map(n => n.agent.address), ["b", "unmapped", "a"]);
assert.deepEqual(addresses(agentTreeBySpace([...agents, agents[0], agents[1]], [...terminals, terminals[1]]).get("one")),
  addresses(tree.get("one")));
console.log("agent tree assertions passed");
