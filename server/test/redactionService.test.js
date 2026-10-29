import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { redactImage, validateRegions } from '../src/services/redactionService.js';
const image = () => sharp({ create: { width: 40, height: 30, channels: 3, background: '#f5f5f5' } }).png().toBuffer();
test('validates in-bounds regions and rejects invalid coordinates/categories', () => {
  assert.equal(validateRegions([{ x: 0, y: 0, width: 5, height: 5, category: 'email' }], 10, 10).length, 1);
  assert.throws(() => validateRegions([{ x: -1, y: 0, width: 5, height: 5, category: 'email' }], 10, 10), /INVALID_REGIONS/);
  assert.throws(() => validateRegions([{ x: 9, y: 9, width: 5, height: 5, category: 'email' }], 10, 10), /INVALID_REGIONS/);
  assert.throws(() => validateRegions([{ x: 0, y: 0, width: 5, height: 5, category: 'secret' }], 10, 10), /INVALID_REGIONS/);
  assert.throws(() => validateRegions([], 10, 10), /NO_REGIONS/);
  assert.throws(() => validateRegions(Array.from({ length: 51 }, () => ({ x: 0, y: 0, width: 1, height: 1, category: 'manual' })), 10, 10), /INVALID_REGIONS/);
});
test('permanently burns selected regions and returns a verified flattened PNG', async () => {
  const result = await redactImage(await image(), [{ x: 5, y: 5, width: 15, height: 10, category: 'manual' }]);
  const metadata = await sharp(result.buffer).metadata();
  const { data, info } = await sharp(result.buffer).raw().toBuffer({ resolveWithObject: true });
  const offset = (8 * info.width + 8) * info.channels;
  assert.equal(metadata.format, 'png'); assert.equal(metadata.width, 40); assert.equal(metadata.height, 30);
  assert.ok(data[offset] < 20 && data[offset + 1] < 40 && data[offset + 2] < 40, 'region pixels are opaque dark redaction marks');
  assert.ok(data[0] > 200, 'pixels outside the region remain unchanged');
});
test('rejects invalid images and unsupported dimensions', async () => {
  await assert.rejects(redactImage(Buffer.from('not an image'), [{ x: 0, y: 0, width: 1, height: 1, category: 'manual' }]), /INVALID_IMAGE/);
  const oversized = await sharp({ create: { width: 6001, height: 1, channels: 3, background: '#fff' } }).png().toBuffer();
  await assert.rejects(redactImage(oversized, [{ x: 0, y: 0, width: 1, height: 1, category: 'manual' }]), /IMAGE_TOO_LARGE/);
});

test('normalizes EXIF orientation before applying browser-coordinate regions', async () => {
  const oriented = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#f5f5f5' } })
    .jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const result = await redactImage(oriented, [{ x: 5, y: 5, width: 10, height: 10, category: 'manual' }]);
  const metadata = await sharp(result.buffer).metadata();
  const { data, info } = await sharp(result.buffer).raw().toBuffer({ resolveWithObject: true });
  const covered = (8 * info.width + 8) * info.channels;
  const uncovered = (30 * info.width + 20) * info.channels;
  assert.equal(metadata.width, 30);
  assert.equal(metadata.height, 40);
  assert.equal(metadata.hasAlpha, false);
  assert.equal(metadata.exif, undefined);
  assert.ok(data[covered] < 20 && data[covered + 1] < 40 && data[covered + 2] < 40);
  assert.ok(data[uncovered] > 200, 'pixels outside the selected box remain visible');
});
