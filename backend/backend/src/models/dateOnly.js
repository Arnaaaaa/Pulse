// Calendar dates (due dates, milestones, sprints, meetings) are stored and returned as "YYYY-MM-DD" strings,
// which sort and compare correctly as text. Timestamps (createdAt, comment dates, ...) stay real Dates.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const dateOnly = (extra = {}) => ({
  type: String,
  set: (v) => (v ? String(v).slice(0, 10) : null),
  match: [DATE_RE, "{PATH} must be a YYYY-MM-DD date"],
  default: null,
  ...extra,
});

const todayISO = () => new Date().toISOString().slice(0, 10);

function addInterval(dateStr, freq) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (freq === "Daily") d.setUTCDate(d.getUTCDate() + 1);
  else if (freq === "Monthly") d.setUTCMonth(d.getUTCMonth() + 1);
  else d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

module.exports = { dateOnly, todayISO, addInterval, DATE_RE };
