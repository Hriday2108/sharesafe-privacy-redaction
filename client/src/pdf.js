import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDF_MAX_PAGE_DIMENSION, PDF_MAX_PAGE_PIXELS, PDF_MAX_PAGES } from './pdfLimits.js';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
export function pdfRenderScale(width, height) {
  return Math.min(1.5, PDF_MAX_PAGE_DIMENSION / Math.max(width, height), Math.sqrt(PDF_MAX_PAGE_PIXELS / (width * height)));
}
export async function renderPdfPages(file) {
  const task = pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false });
  const document = await task.promise;
  const pages = [];
  try {
    if (document.numPages < 1 || document.numPages > PDF_MAX_PAGES) throw new Error(`PDFs can contain up to ${PDF_MAX_PAGES} pages.`);
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number);
      const base = page.getViewport({ scale: 1 });
      const scale = pdfRenderScale(base.width, base.height);
      const viewport = page.getViewport({ scale });
      const canvas = window.document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d', { alpha: false });
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport }).promise;
      const blob = await new Promise((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('PDF page could not be rendered.')), 'image/png'));
      pages.push({ page: number, width: canvas.width, height: canvas.height, blob, preview: URL.createObjectURL(blob) });
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
    }
    return pages;
  } catch (error) {
    pages.forEach((page) => URL.revokeObjectURL(page.preview));
    throw error;
  } finally { await task.destroy(); }
}
