export const PROGRESS_KEY='gert-studio:tutorial-progress:v1';
export function readProgress():string[] {
  try {
    const saved:unknown=JSON.parse(localStorage.getItem(PROGRESS_KEY)||'null');
    if(saved && typeof saved==='object' && 'version' in saved && saved.version===1 && 'completed' in saved && Array.isArray(saved.completed)) return [...new Set(saved.completed.filter((id):id is string=>typeof id==='string'&&/^lesson-(?:[0-9]|1[0-9]|2[01])$/.test(id)))];
  } catch { /* Storage may be unavailable. Session progress still works. */ }
  return [];
}
export function saveProgress(completed:string[]) {
  try {localStorage.setItem(PROGRESS_KEY,JSON.stringify({version:1,completed}));} catch { /* Best effort; never save model or results here. */ }
}
