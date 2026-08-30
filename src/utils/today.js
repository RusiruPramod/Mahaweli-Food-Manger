/**
 * Returns today's date as "YYYY-MM-DD" in the Asia/Colombo timezone.
 * This ensures all members share the same "day" regardless of device locale.
 */
export function getToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
