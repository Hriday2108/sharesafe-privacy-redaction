import test from 'node:test';
import assert from 'node:assert/strict';
import { mapPointerToPixels, moveRegion, resizeRegion } from '../src/editorGeometry.js';

test('pointer coordinates map consistently at fit and zoomed CSS scales', () => {
  const dimensions = { width: 1200, height: 700 };
  const fit = mapPointerToPixels(300, 175, { left: 0, top: 0, width: 600, height: 350 }, dimensions);
  const zoom = mapPointerToPixels(600, 350, { left: 0, top: 0, width: 1200, height: 700 }, dimensions);
  assert.deepEqual(fit, { x: 600, y: 350 });
  assert.deepEqual(zoom, fit);
});

test('move and resize operations stay within the page bounds', () => {
  const region = { x: 20, y: 30, width: 40, height: 25 };
  assert.deepEqual(moveRegion(region, 1000, -100, { width: 100, height: 80 }), { ...region, x: 60, y: 0 });
  assert.deepEqual(resizeRegion(region, 100, 100, { width: 100, height: 80 }), { ...region, width: 80, height: 50 });
  assert.deepEqual(resizeRegion(region, -100, -100, { width: 100, height: 80 }), { ...region, width: 1, height: 1 });
});
