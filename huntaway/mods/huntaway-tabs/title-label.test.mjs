import test from "node:test";
import assert from "node:assert/strict";
import { tabLabel } from "./title-label.js";

const agent = { terminal: "t12", title: "✦ Reviewing auth flow", program: { agent: true, name: "Claude Code", key: "claude" } };
test("uses a live agent session title for unnamed and default-named tabs", () => {
  assert.equal(tabLabel({ name: "1", named: false }, agent), "Reviewing auth flow");
  assert.equal(tabLabel({ name: "Claude Code", named: true }, agent), "Reviewing auth flow");
});
test("keeps a person-named tab and ordinary terminal behavior", () => {
  assert.equal(tabLabel({ name: "My task", named: true }, agent), "My task");
  assert.equal(tabLabel({ name: "1", named: false }, { program: { agent: false, name: "zsh" }, title: "~/repo" }), "zsh");
});
test("does not mistake a path or machine address for a session title", () => {
  assert.equal(tabLabel({ name: "1", named: false }, { ...agent, title: "~/repo" }), "Claude Code");
  assert.equal(tabLabel({ name: "1", named: false }, { ...agent, terminal: "vps/t12", title: "vps/t12" }), "Claude Code");
});
test("uses the terminal address when Antigravity has no session title", () => {
  const agy = { terminal: "t55", title: "~/repo", program: { agent: true, name: "Antigravity", key: "antigravity" } };
  assert.equal(tabLabel({ name: "Antigravity", named: true }, agy), "t55");
  assert.equal(tabLabel({ name: "My task", named: true }, agy), "My task");
  assert.equal(tabLabel({ name: "1", named: false }, { ...agy, terminal: "vps/t55" }), "vps/t55");
});
