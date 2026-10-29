import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { redactPdf } from '../src/services/pdfRedactionService.js';

test('PDF redaction outputs a verified image-only PDF with no searchable source text', async () => {
  const source = await PDFDocument.create();
  source.setTitle('Synthetic private title');
  source.setAuthor('Synthetic author');
  source.setCreationDate(new Date('2020-01-01T00:00:00Z'));
  await source.attach(Buffer.from('synthetic attachment'), 'synthetic.txt');
  const page = source.addPage([612, 792]);
  const font = await source.embedFont(StandardFonts.Helvetica);
  page.drawText('SYNTHETIC EMAIL: alex@example.test', { x: 44, y: 700, size: 18, font });
  const input = Buffer.from(await source.save());
  const result = await redactPdf(input, [{ category: 'manual', page: 1, x: 0, y: 0, width: 918, height: 1188 }]);
  assert.equal(result.fileType, 'pdf');
  const outputTask = pdfjsLib.getDocument({ data: new Uint8Array(result.buffer), isEvalSupported: false });
  const output = await outputTask.promise;
  assert.equal(output.numPages, 1);
  const outputPage = await output.getPage(1);
  assert.equal((await outputPage.getTextContent()).items.length, 0);
  assert.equal((await outputPage.getAnnotations({ intent: 'display' })).length, 0);
  assert.equal(await output.getAttachments(), null);
  const outputMetadata = await output.getMetadata();
  assert.equal(outputMetadata.info.Title, undefined);
  assert.equal(outputMetadata.info.Author, undefined);
  assert.equal(outputMetadata.info.CreationDate, undefined);
  const operators = await outputPage.getOperatorList();
  assert.ok(operators.fnArray.some((fn) => fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintJpegXObject || fn === pdfjsLib.OPS.paintInlineImageXObject));
  await outputTask.destroy();
});

test('PDF redaction rejects malformed files and out-of-page coordinates', async () => {
  await assert.rejects(() => redactPdf(Buffer.from('not a PDF'), []), /INVALID_PDF/);
  const source = await PDFDocument.create(); source.addPage([612, 792]);
  const input = Buffer.from(await source.save());
  await assert.rejects(() => redactPdf(input, [{ category: 'manual', page: 2, x: 0, y: 0, width: 20, height: 20 }]), /INVALID_REGIONS/);
});

test('PDF redaction preserves every page when selections target only one page', async () => {
  const source = await PDFDocument.create();
  source.addPage([612, 792]);
  source.addPage([612, 792]);
  const input = Buffer.from(await source.save());
  const result = await redactPdf(input, [{ category: 'manual', page: 2, x: 20, y: 20, width: 40, height: 40 }]);
  const outputTask = pdfjsLib.getDocument({ data: new Uint8Array(result.buffer), isEvalSupported: false });
  const output = await outputTask.promise;
  assert.equal(output.numPages, 2);
  await outputTask.destroy();
});


test('PDF redaction rejects files over the configured input size limit', async () => {
  const oversized = Buffer.alloc(4 * 1024 * 1024 + 1);
  oversized.write('%PDF-');
  await assert.rejects(() => redactPdf(oversized, []), /PDF_TOO_LARGE/);
});
