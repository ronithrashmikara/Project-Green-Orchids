// Timezone-correct date helpers (F3.1). The business runs Asia/Colombo (UTC+5:30)
// while Render runs UTC; due dates and aging must be computed in Colombo time.
const COLOMBO_OFFSET_MIN = 5 * 60 + 30; // +05:30

// Map a trade_account payment_term to a day count.
const TERM_DAYS = { PREPAID: 0, NET_15: 15, NET_30: 30, NET_45: 45, NET_60: 60 };

function termToDays(term) {
  return TERM_DAYS[term] != null ? TERM_DAYS[term] : 30;
}

// Today's date in Asia/Colombo as a YYYY-MM-DD string.
function toColomboDate(d = new Date()) {
  const shifted = new Date(d.getTime() + COLOMBO_OFFSET_MIN * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

// Due date = Colombo issue date + term days, returned as YYYY-MM-DD (Finding 12).
function dueDateForTerm(term, issued = new Date()) {
  const days = termToDays(term);
  const base = new Date(issued.getTime() + COLOMBO_OFFSET_MIN * 60 * 1000);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

module.exports = { toColomboDate, dueDateForTerm, termToDays, TERM_DAYS };
