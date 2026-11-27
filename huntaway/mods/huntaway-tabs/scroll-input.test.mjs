import test from "node:test";
import assert from "node:assert/strict";
import { nextScrollIndex, wheelInput, wheelSteps } from "./scroll-input.js";

test("waits for accumulated pixel movement before advancing", () => {
  assert.deepEqual(wheelSteps(16, 0, 48), { steps: 0, remainder: 16 });
  assert.deepEqual(wheelSteps(16, 16, 48), { steps: 0, remainder: 32 });
  assert.deepEqual(wheelSteps(16, 32, 48), { steps: 1, remainder: 0 });
});

test("reversing direction cancels a partial wheel movement", () => {
  assert.deepEqual(wheelSteps(-20, 30, 48), { steps: 0, remainder: 10 });
});

test("uses reported wheel lines when available", () => {
  assert.deepEqual(wheelInput({ delta: { x: 12, y: 80 }, delta_lines: { x: 0.5, y: 3 } }, "y"), {
    delta: 3, threshold: 4,
  });
  assert.deepEqual(wheelInput({ delta: { x: 12, y: 80 } }, "y"), {
    delta: 80, threshold: 48,
  });
});

test("moves to a child wholly beyond the viewport in either direction", () => {
  const widths = [70, 70, 70, 70, 70];
  assert.equal(nextScrollIndex(widths, 0, 200, 1), 3);
  assert.equal(nextScrollIndex(widths, 200, 200, -1), 1);
  assert.equal(nextScrollIndex(widths, 0, 200, -1), null);
  assert.equal(nextScrollIndex(widths, 0, 200, 1, 2), 4);
});
