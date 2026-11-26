import assert from "node:assert/strict";
import { agentTreeBySpace, reorderAgentRoots } from "./agent-tree.js";

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
assert.deepEqual(addresses(agentTreeBySpace([...agents, agents[0], agents[1]], [...terminals, terminals[1]]).get("one")),
  addresses(tree.get("one")));
console.log("agent tree assertions passed");
