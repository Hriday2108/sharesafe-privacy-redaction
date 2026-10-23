import sharp from 'sharp';
const MAX_REGIONS = 50;
export function validateRegions(regions, width, height) {
  if (!Array.isArray(regions) || regions.length === 0 || regions.length > MAX_REGIONS) throw new Error(regions?.length === 0 ? 'NO_REGIONS' : 'INVALID_REGIONS');
  const allowed = new Set(['email', 'phone', 'identifier', 'manual']);
  for (const region of regions) {
    if (!region || !Number.isFinite(region.x) || !Number.isFinite(region.y) || !Number.isFinite(region.width) || !Number.isFinite(region.height) || !allowed.has(region.category)) throw new Error('INVALID_REGIONS');
    const { x, y, width: w, height: h } = region;
    if (w < 1 || h < 1 || x < 0 || y < 0 || x + w > width || y + h > height) throw new Error('INVALID_REGIONS');
  }
  return regions;
}
export async function redactImage(buffer, regions) {
  let metadata;
  try { metadata = await sharp(buffer, { limitInputPixels: 36_000_000, failOn: 'error' }).metadata(); } catch { throw new Error('INVALID_IMAGE'); }
  if (!['png', 'jpeg'].includes(metadata.format) || !metadata.width || !metadata.height) throw new Error('INVALID_IMAGE');
  if (metadata.width > 6000 || metadata.height > 6000 || metadata.width * metadata.height > 36_000_000) throw new Error('IMAGE_TOO_LARGE');
  validateRegions(regions, metadata.width, metadata.height);
  const overlays = regions.map(({ x, y, width, height }) => ({ input: { create: { width: Math.max(1, Math.ceil(width)), height: Math.max(1, Math.ceil(height)), channels: 4, background: '#071b18' } }, left: Math.floor(x), top: Math.floor(y) }));
  const output = await sharp(buffer).rotate().composite(overlays).png({ compressionLevel: 9 }).toBuffer();
  const verified = await sharp(output, { failOn: 'error' }).metadata();
  if (verified.format !== 'png' || verified.width !== metadata.width || verified.height !== metadata.height) throw new Error('INVALID_IMAGE');
  return { buffer: output, width: verified.width, height: verified.height, fileType: metadata.format };
}
