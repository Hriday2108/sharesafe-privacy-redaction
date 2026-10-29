import sharp from 'sharp';
import { redactPdf } from './pdfRedactionService.js';
const MAX_REGIONS = 50;
export function validateRegions(regions, width, height) {
  if (!Array.isArray(regions) || regions.length === 0 || regions.length > MAX_REGIONS) throw new Error(regions?.length === 0 ? 'NO_REGIONS' : 'INVALID_REGIONS');
  const allowed = new Set(['email', 'phone', 'identifier', 'manual']);
  for (const region of regions) {
    if (!region || ![region.x, region.y, region.width, region.height].every(Number.isInteger) || !allowed.has(region.category)) throw new Error('INVALID_REGIONS');
    const { x, y, width: w, height: h } = region;
    if (w < 1 || h < 1 || x < 0 || y < 0 || x + w > width || y + h > height) throw new Error('INVALID_REGIONS');
  }
  return regions;
}
export async function redactImage(buffer, regions) {
  let metadata;
  let normalized;
  try {
    metadata = await sharp(buffer, { limitInputPixels: 36_000_000, failOn: 'error' }).metadata();
    normalized = await sharp(buffer, { limitInputPixels: 36_000_000, failOn: 'error' }).rotate().toBuffer();
  } catch { throw new Error('INVALID_IMAGE'); }
  if (!['png', 'jpeg'].includes(metadata.format) || !metadata.width || !metadata.height) throw new Error('INVALID_IMAGE');
  const normalizedMetadata = await sharp(normalized, { failOn: 'error' }).metadata();
  if (normalizedMetadata.width > 6000 || normalizedMetadata.height > 6000 || normalizedMetadata.width * normalizedMetadata.height > 36_000_000) throw new Error('IMAGE_TOO_LARGE');
  // OCR coordinates correspond to the visually oriented bitmap. Normalize EXIF orientation first.
  validateRegions(regions, normalizedMetadata.width, normalizedMetadata.height);
  const overlays = regions.map(({ x, y, width, height }) => ({ input: { create: { width: Math.max(1, Math.ceil(width)), height: Math.max(1, Math.ceil(height)), channels: 4, background: '#071b18' } }, left: Math.floor(x), top: Math.floor(y) }));
  const output = await sharp(normalized).composite(overlays).flatten({ background: '#ffffff' }).removeAlpha().toColourspace('srgb').png({ compressionLevel: 9 }).toBuffer();
  const verified = await sharp(output, { failOn: 'error' }).metadata();
  if (verified.format !== 'png' || verified.width !== normalizedMetadata.width || verified.height !== normalizedMetadata.height || verified.hasAlpha || verified.exif || verified.iptc || verified.xmp || verified.icc) throw new Error('IMAGE_VERIFICATION_FAILED');
  return { buffer: output, width: verified.width, height: verified.height, fileType: metadata.format, verification: ['output-is-png', 'dimensions-verified', 'flattened-pixels', 'source-metadata-not-carried'] };
}
export async function redactUploadedFile(buffer, regions) {
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return redactPdf(buffer, regions);
  if (regions.some((region) => region?.page !== undefined && region.page !== 1)) throw new Error('INVALID_REGIONS');
  return redactImage(buffer, regions);
}
