import test from "node:test";
import assert from "node:assert/strict";
import { dropMarkerIndex, fitTabs } from "./fit-tabs.js";

const sizes = tabs => fitTabs(tabs, (tab, compact) => compact ? tab.min : tab.full, 100);

test("keeps full labels when all tabs fit", () => {
  assert.deepEqual(fitTabs([{ full: 40 }, { full: 50 }], t => t.full, 100), {
    compact: false, overflow: false,
  });
});

test("compacts tabs when their full labels do not fit", () => {
  assert.deepEqual(fitTabs([{ full: 80, min: 30 }, { full: 80, min: 30 }], (t, compact) => compact ? t.min : t.full, 100), {
    compact: true, overflow: false,
  });
});

test("reports real overflow when compact tabs still exceed room", () => {
  assert.deepEqual(sizes(Array.from({ length: 5 }, () => ({ full: 80, min: 30 }))), {
    compact: true, overflow: true,
  });
});

test("reports overflow for a single active tab wider than room", () => {
  assert.deepEqual(fitTabs([{ active: true, full: 170, min: 42 }], (tab, compact) => compact ? tab.min : tab.full, 80), {
    compact: true, overflow: true,
  });
});

test("places drag markers by absolute indexes when every tab overflows", () => {
  const tabs = Array.from({ length: 12 }, (_, i) => ({ active: i === 8, full: 100, min: 33 }));
  const result = fitTabs(tabs, (tab, compact) => compact ? tab.min : tab.full, 120);
  assert.deepEqual(result, { compact: true, overflow: true });
  assert.equal(dropMarkerIndex(9, 2), 2);
  assert.equal(dropMarkerIndex(2, 9), 10);
});
