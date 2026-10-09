// Newsletter helpers for the Stay Conscious page (v4.1.2, v4.2.0).

// Admin note on the earned creative search (v4.1.2). Null when the issue has
// three fresh examples, or when it predates the saved status.
export function ecStatusNote(ec) {
  const st = ec?.status;
  if (!st) return null;
  const n = ec.items?.length || 0;
  if (n >= 3 && !ec.carriedFrom) return null;
  const why = [...new Set(st.reasons || [])].join('; ');
  const ran = `${st.searches} search${st.searches === 1 ? '' : 'es'}, ${st.candidates} candidate${st.candidates === 1 ? '' : 's'}, ${st.passed} passed the article check`;
  if (ec.carriedFrom) return `Earned creative: nothing new passed this week (${ran}${why ? `; ${why}` : ''}), so the examples from issue ${ec.carriedFrom} are shown again.`;
  if (!n) return `Earned creative: no section this issue (${ran}${why ? `; ${why}` : ''}). Force refresh tries again.`;
  return `Earned creative: ${n} of 3 found (${ran}${why ? `; ${why}` : ''}).`;
}

// The weekly job runs at 23:30 UTC on Sunday (vercel.json), shown in the
// reader's own time zone (v4.2.0: it was shown as 11:30 PM local, which was
// wrong everywhere but UTC).
export const nextIssueAt = (now = new Date()) => {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 30));
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7));
  if (d <= now) d.setUTCDate(d.getUTCDate() + 7);
  return d;
};
