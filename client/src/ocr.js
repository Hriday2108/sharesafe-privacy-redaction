import { createWorker } from 'tesseract.js';
const patterns = [
  { category: 'email', regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
  { category: 'phone', regex: /(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)/g },
  { category: 'identifier', regex: /(?<!\w)(?:SSN|ID|ACCOUNT)\s*[:#-]?\s*[A-Z0-9-]{5,}(?!\w)/gi },
];
async function getImageSize(file) {
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}
export async function scanImage(file, onProgress = () => {}) {
  const worker = await createWorker('eng', 1, { logger: (message) => { if (message.status === 'recognizing text') onProgress(Math.round(message.progress * 100)); } });
  try {
    // Tesseract.js 6 returns text only by default. Ask for blocks so word
    // boxes are available for the review UI's pixel-coordinate selections.
    const { data } = await worker.recognize(file, {}, { blocks: true });
    const size = await getImageSize(file);
    const lines = (data.blocks || []).flatMap((block) =>
      (block.paragraphs || []).flatMap((paragraph) => paragraph.lines || []),
    );
    const matches = [];
    for (const line of lines) for (const { category, regex } of patterns) {
      regex.lastIndex = 0;
      if (!regex.test(line.text) || !line.bbox) continue;
      const x = Math.max(0, Math.floor(line.bbox.x0 - 8));
      const y = Math.max(0, Math.floor(line.bbox.y0 - 5));
      const right = Math.min(size.width, Math.ceil(line.bbox.x1 + 8));
      const bottom = Math.min(size.height, Math.ceil(line.bbox.y1 + 5));
      if (right <= x || bottom <= y) continue;
      matches.push({ id: `${category}-${matches.length}`, category, label: category === 'email' ? 'Email address' : category === 'phone' ? 'Phone number' : 'Configured identifier', x, y, width: right - x, height: bottom - y, selected: true });
    }
    return { width: size.width, height: size.height, detections: matches };
  } finally { await worker.terminate(); }
}
