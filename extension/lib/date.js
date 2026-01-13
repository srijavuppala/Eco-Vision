export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function toISODate(value) {
  if (!value) return todayISO();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return todayISO();
  return date.toISOString().slice(0, 10);
}

export function startOfISOWeek(dateISO) {
  const date = new Date(`${dateISO}T00:00:00Z`);
  const day = date.getUTCDay();
  const diff = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  return date.toISOString().slice(0, 10);
}

