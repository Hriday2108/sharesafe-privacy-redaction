import sharp from 'sharp';
import { createCanvas } from '@napi-rs/canvas';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const MAX_PAGES = 8;
const MAX_PIXELS_PER_PAGE = 2_000_000;
const MAX_DIMENSION = 1800;
const MAX_TOTAL_PIXELS = 16_000_000;
const MAX_REGIONS = 50;
const SCALE_CAP = 1.5;
const allowedCategories = new Set(['email', 'phone', 'identifier', 'manual']);

function scaleFor(width, height) {
  return Math.min(SCALE_CAP, MAX_DIMENSION / Math.max(width, height), Math.sqrt(MAX_PIXELS_PER_PAGE / (width * height)));
}
function validatePdfRegions(regions, pageCount, dimensions) {
  if (!Array.isArray(regions) || regions.length === 0 || regions.length > MAX_REGIONS) throw new Error(regions?.length === 0 ? 'NO_REGIONS' : 'INVALID_REGIONS');
  for (const region of regions) {
    if (!region || !Number.isInteger(region.page) || region.page < 1 || region.page > pageCount || !allowedCategories.has(region.category) || ![region.x, region.y, region.width, region.height].every(Number.isInteger)) throw new Error('INVALID_REGIONS');
    const size = dimensions[region.page - 1];
    if (region.x < 0 || region.y < 0 || region.width < 1 || region.height < 1 || region.x + region.width > size.width || region.y + region.height > size.height) throw new Error('INVALID_REGIONS');
  }
}
function pdfTask(buffer) {
  return pdfjsLib.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: true, disableFontFace: true, verbosity: 0 });
}

export async function redactPdf(buffer, regions) {
  if (buffer.length > 4 * 1024 * 1024 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error(buffer.length > 4 * 1024 * 1024 ? 'PDF_TOO_LARGE' : 'INVALID_PDF');
  let input;
  let inputTask;
  try { inputTask = pdfTask(buffer); input = await inputTask.promise; } catch { throw new Error('INVALID_PDF'); }
  try {
    if (input.numPages < 1 || input.numPages > MAX_PAGES) throw new Error('PDF_TOO_MANY_PAGES');
    const pageInfo = [];
    let totalPixels = 0;
    for (let pageNo = 1; pageNo <= input.numPages; pageNo += 1) {
      const page = await input.getPage(pageNo);
      const base = page.getViewport({ scale: 1 });
      const scale = scaleFor(base.width, base.height);
      const viewport = page.getViewport({ scale });
      const width = Math.ceil(viewport.width);
      const height = Math.ceil(viewport.height);
      totalPixels += width * height;
      if (!width || !height || width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS_PER_PAGE || totalPixels > MAX_TOTAL_PIXELS) throw new Error('PDF_TOO_LARGE');
      pageInfo.push({ page, viewport, width, height, pointWidth: base.width, pointHeight: base.height });
    }
    validatePdfRegions(regions, input.numPages, pageInfo);
    const output = await PDFDocument.create();
    output.setProducer('ShareSafe');
    output.setCreator('ShareSafe PDF redaction');
    for (let index = 0; index < pageInfo.length; index += 1) {
      const { page, viewport, width, height, pointWidth, pointHeight } = pageInfo[index];
      const canvas = createCanvas(width, height);
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      try { await page.render({ canvasContext: context, viewport, canvas }).promise; } catch { throw new Error('INVALID_PDF'); }
      const overlays = regions.filter((region) => region.page === index + 1).map(({ x, y, width: w, height: h }) => ({
        input: { create: { width: Math.max(1, Math.ceil(w)), height: Math.max(1, Math.ceil(h)), channels: 4, background: '#071b18' } },
        left: Math.floor(x), top: Math.floor(y),
      }));
      const flattened = await sharp(canvas.toBuffer('image/png')).composite(overlays).jpeg({ quality: 90, chromaSubsampling: '4:4:4' }).toBuffer();
      canvas.width = 0;
      canvas.height = 0;
      const embedded = await output.embedJpg(flattened);
      const outPage = output.addPage([pointWidth, pointHeight]);
      outPage.drawImage(embedded, { x: 0, y: 0, width: pointWidth, height: pointHeight });
      page.cleanup();
    }
    const bytes = Buffer.from(await output.save({ useObjectStreams: true }));
    if (bytes.length > 4 * 1024 * 1024) throw new Error('PDF_TOO_LARGE');
    let verified;
    let verifiedTask;
    try { verifiedTask = pdfTask(bytes); verified = await verifiedTask.promise; } catch { throw new Error('PDF_VERIFICATION_FAILED'); }
    try {
      if (verified.numPages !== input.numPages) throw new Error('PDF_VERIFICATION_FAILED');
      for (let pageNo = 1; pageNo <= verified.numPages; pageNo += 1) {
        const page = await verified.getPage(pageNo);
        const text = await page.getTextContent();
        if (text.items.length !== 0) throw new Error('PDF_VERIFICATION_FAILED');
        const operators = await page.getOperatorList();
        const hasImage = operators.fnArray.some((fn) => fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintJpegXObject || fn === pdfjsLib.OPS.paintInlineImageXObject);
        if (!hasImage) throw new Error('PDF_VERIFICATION_FAILED');
        page.cleanup();
      }
    } finally { await verifiedTask.destroy(); }
    return { buffer: bytes, fileType: 'pdf', pageCount: input.numPages };
  } finally { await inputTask.destroy(); }
}
