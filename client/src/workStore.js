let currentWork = null;

export function saveWork(work) {
  // Keep originals and OCR results only in this tab's memory, never in web storage.
  currentWork = work;
}

export function getWork() {
  return currentWork;
}

export function clearWork() {
  if (currentWork?.kind === 'pdf') currentWork.pages.forEach((page) => URL.revokeObjectURL(page.preview));
  currentWork = null;
}
