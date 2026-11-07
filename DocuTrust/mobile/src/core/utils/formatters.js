const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parse(iso) {
  if (iso == null || iso === '') return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

export function relativeTime(iso) {
  const then = parse(iso);
  if (then === null) return '';
  const diff = Date.now() - then;
  if (diff === 0) return 'just now';
  const future = diff < 0;
  const mins = Math.round(Math.abs(diff) / 60000);
  let span;
  if (mins < 1) return 'just now';
  if (mins < 60) span = `${mins} min`;
  else if (mins < 60 * 24) span = `${Math.round(mins / 60)} h`;
  else if (mins < 60 * 24 * 30) span = `${Math.round(mins / (60 * 24))} d`;
  else span = `${Math.round(mins / (60 * 24 * 30))} mo`;
  return future ? `in ${span}` : `${span} ago`;
}

export function formatDate(iso) {
  const t = parse(iso);
  if (t === null) return '—';
  const d = new Date(t);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateTime(iso) {
  const t = parse(iso);
  if (t === null) return '—';
  const d = new Date(t);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(iso)} · ${hh}:${mm}`;
}

export function formatBytes(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  const b = Number(n);
  if (b <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
  const v = b / Math.pow(1024, i);
  return `${i === 0 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, '')} ${units[i]}`;
}

export function daysUntil(iso) {
  const t = parse(iso);
  if (t === null) return null;
  return Math.ceil((t - Date.now()) / 86400000);
}

export function shortHash(hash) {
  if (!hash || typeof hash !== 'string') return '—';
  if (hash.length <= 18) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}
