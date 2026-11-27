import test from "node:test";
import assert from "node:assert/strict";
import { tabDragGesture } from "./drag-gesture.js";

test("gesture direction uses full tab indexes when settled tabs precede the target", () => {
  const tabs = [
    { id: "hidden-1", settled: true },
    { id: "hidden-2", settled: true },
    { id: "hidden-3", settled: true },
    { id: "target" },
    { id: "visible-middle" },
    { id: "source" },
  ];
  const shown = tabs.filter(tab => !tab.settled);
  const sourceShownIndex = shown.findIndex(tab => tab.id === "source");
  const targetIndex = tabs.findIndex(tab => tab.id === "target");
  assert(sourceShownIndex < targetIndex); // Mixed indexes would incorrectly say "after".
  assert.equal(tabDragGesture({ id: "space", tabs }, "source", "target", 7).after, false);
});

test("returns null when either tab is no longer in the full space", () => {
  assert.equal(tabDragGesture({ id: "space", tabs: [{ id: "target" }] }, "missing", "target", 8), null);
});
