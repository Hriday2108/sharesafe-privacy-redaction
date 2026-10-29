let currentWork = null;
export function saveWork(work) {
  currentWork = work;
  if (work.kind === 'pdf') sessionStorage.removeItem('sharesafe_work');
  else sessionStorage.setItem('sharesafe_work', JSON.stringify(work));
}
export function getWork() {
  if (currentWork) return currentWork;
  try { currentWork = JSON.parse(sessionStorage.getItem('sharesafe_work')); } catch { currentWork = null; }
  return currentWork;
}
export function clearWork() {
  if (currentWork?.kind === 'pdf') currentWork.pages.forEach((page) => URL.revokeObjectURL(page.preview));
  currentWork = null;
  sessionStorage.removeItem('sharesafe_work');
}
