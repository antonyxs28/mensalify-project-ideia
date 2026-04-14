export function buildLocalDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function parseLocalDate(value: string, fallback: Date): Date {
  if (!value || value === "null") {
    return fallback;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return fallback;
  }
  return buildLocalDate(year, month, day);
}

export function getValidDueDate(year: number, month: number, dueDay: number): Date {
  const candidate = buildLocalDate(year, month, dueDay);
  if (candidate.getMonth() !== month - 1) {
    return buildLocalDate(year, month + 1, 0);
  }
  return candidate;
}

export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}