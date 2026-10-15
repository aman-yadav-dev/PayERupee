export function formatDateIST(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "Invalid Date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata"
  }).format(d);
}

export function formatTimeIST(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "Invalid Time";
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata"
  }).format(d).toLowerCase();
}

export function formatDateTimeIST(date: Date | string | number): string {
  if (!date) return "N/A";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "Invalid Date";
  return `${formatDateIST(d)}, ${formatTimeIST(d)}`;
}

/**
 * Returns UTC boundaries (start/end) representing the correct IST calendar days.
 * Timezone-safe and deterministic regardless of the server/browser local timezone.
 */
export function getISTDateBoundaries(rangeType: string, customStart?: string, customEnd?: string): { startDate?: string, endDate?: string } {
  // Current time in UTC
  const now = new Date();
  
  // Format current UTC time into IST parts to get "today" in IST
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  
  // Create a Date object representing the current IST time (treating it as if it were UTC)
  // so we can cleanly do day math.
  const istNow = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second)));
  
  const constructBoundary = (d: Date, startOfDay: boolean) => {
    // Construct the string "YYYY-MM-DDTHH:mm:ss.000+05:30"
    const yr = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const da = String(d.getUTCDate()).padStart(2, '0');
    const time = startOfDay ? "00:00:00.000" : "23:59:59.999";
    const istString = `${yr}-${mo}-${da}T${time}+05:30`;
    return new Date(istString).toISOString();
  };

  if (rangeType === "Last 7 days") {
    const start = new Date(istNow);
    start.setUTCDate(start.getUTCDate() - 7);
    return { startDate: constructBoundary(start, true), endDate: constructBoundary(istNow, false) };
  } 
  
  if (rangeType === "Last 30 days") {
    const start = new Date(istNow);
    start.setUTCDate(start.getUTCDate() - 30);
    return { startDate: constructBoundary(start, true), endDate: constructBoundary(istNow, false) };
  } 
  
  if (rangeType === "This month") {
    const start = new Date(istNow);
    start.setUTCDate(1);
    return { startDate: constructBoundary(start, true), endDate: constructBoundary(istNow, false) };
  }
  
  if (customStart && customEnd) {
    const s = new Date(`${customStart}T00:00:00.000+05:30`);
    const e = new Date(`${customEnd}T23:59:59.999+05:30`);
    if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
      return { startDate: s.toISOString(), endDate: e.toISOString() };
    }
  }

  return {};
}
