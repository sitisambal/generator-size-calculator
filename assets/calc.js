// Generator sizing math for the web page.
//
// The first block mirrors the Generator Load Check iPhone app line for line:
//   apps/generator-load-check/lib/loadMath.ts   totals, verdict, startLimit, remaining
//   apps/generator-load-check/lib/sizing.ts     sizeToBuy (and PORTABLE_MAX_RUNNING)
//   apps/generator-load-check/lib/customItem.ts parseCustomItem
// tests/parity.test.js runs the app's TypeScript and this file side by side.
// The site must never disagree with the app: change the app first, then this.

// ---------------------------------------------------------------- app mirror

/** Running load plus the single largest start kick (motors are assumed not to start together). */
export function totals(items) {
  const running = items.reduce((sum, item) => sum + Math.max(0, item.running), 0);
  const extraStart = items.reduce((max, item) => {
    const kick = Math.max(0, item.starting - item.running);
    return Math.max(max, kick);
  }, 0);
  return { running, extraStart, peak: running + extraStart };
}

/** 'need-size' | 'empty' | 'ok' | 'tight' | 'surge' | 'over' */
export function verdict(running, peak, cap, surgeCap = null) {
  if (cap == null || cap <= 0) return 'need-size';
  if (running <= 0) return 'empty';
  if (running > cap) return 'over';
  // A generator never starts less than it runs, so a lower typed number is a slip.
  if (peak > startLimit(cap, surgeCap)) return 'surge';
  if (running > cap * 0.8) return 'tight';
  return 'ok';
}

/** Watts the generator can give for a motor start. Falls back to running watts. */
export function startLimit(cap, surgeCap = null) {
  return surgeCap != null && surgeCap > cap ? surgeCap : cap;
}

export function remaining(running, cap) {
  if (cap == null || cap <= 0) return null;
  return cap - running;
}

// Advice is the two numbers printed on every generator label. Marketing classes
// are not used: small inverters are named for starting watts (a "2000 W" model
// runs about 1,600 W) while big portables are often named for running watts, so
// no single class table is right for both.

/** Largest common portables run about 12,000 to 16,000 W. Past that is standby territory. */
export const PORTABLE_MAX_RUNNING = 16000;

const up100 = (n) => Math.ceil(n / 100) * 100;

/**
 * Running watts should sit at or under 80% of the generator's running rating,
 * and its starting (surge) rating must cover the biggest start on top of the load.
 */
export function sizeToBuy(running, peak) {
  if (!(running > 0)) return null;
  const needRunning = up100(running / 0.8);
  const needStarting = up100(Math.max(peak, needRunning));
  return { running: needRunning, starting: needStarting, standby: needRunning > PORTABLE_MAX_RUNNING };
}

/**
 * Read the "Add your own" fields. Starting watts are optional: blank means the
 * item has no motor kick. A starting number below running is treated as running.
 */
export function parseCustomItem(name, watts, startWatts) {
  const n = name.trim();
  const w = Number(watts);
  if (!n || !Number.isFinite(w) || w <= 0) return null;
  const startRaw = startWatts.trim();
  const start = startRaw ? Number(startRaw) : w;
  if (!Number.isFinite(start) || start <= 0) return null;
  return {
    name: n,
    running: Math.round(w),
    starting: Math.round(Math.max(w, start)),
  };
}

// ------------------------------------------------------------- web helpers

export const INVERTER_EFFICIENCY = 0.85;
export const MAX_QTY = 20;
export const MAX_WATTS = 100000;

/** Rows with a quantity become one load item per unit, so the app's totals() applies unchanged. */
export function expand(rows) {
  const items = [];
  for (const row of rows) {
    const qty = Math.max(0, Math.floor(row.qty ?? 1));
    for (let i = 0; i < qty; i += 1) items.push({ running: row.running, starting: row.starting });
  }
  return items;
}

/** The row whose start kick is the one totals() adds. First one wins a tie. */
export function biggestKickRow(rows) {
  let best = null;
  let bestKick = 0;
  for (const row of rows) {
    if (!(row.qty > 0)) continue;
    const kick = Math.max(0, row.starting - row.running);
    if (kick > bestKick) {
      best = row;
      bestKick = kick;
    }
  }
  return best;
}

/** Everything the page shows for one list of rows and an optional generator. */
export function plan(rows, generator = {}) {
  const t = totals(expand(rows));
  const units = generator.parallel ? 2 : 1;
  const cap = generator.running > 0 ? generator.running * units : null;
  const surgeCap = generator.starting > 0 ? generator.starting * units : null;
  return {
    ...t,
    kickRow: biggestKickRow(rows),
    size: sizeToBuy(t.running, t.peak),
    cap,
    surgeCap,
    startLimit: cap == null ? null : startLimit(cap, surgeCap),
    left: remaining(t.running, cap),
    verdict: verdict(t.running, t.peak, cap, surgeCap),
  };
}

/** "1,800 W", "1800", " 1 800 w " -> "1800". Leaves anything else for Number() to reject. */
export function cleanNumber(text) {
  return String(text ?? '')
    .trim()
    .replace(/\s*w(atts?)?\s*$/i, '')
    .replace(/[\s,]/g, '');
}

/** Whole watts from a text field, or null. */
export function parseWatts(text) {
  const raw = cleanNumber(text);
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(MAX_WATTS, Math.round(n));
}

/** Hours a battery runs a load after inverter losses, or null. */
export function runtimeHours(wattHours, loadWatts, efficiency = INVERTER_EFFICIENCY) {
  if (!(wattHours > 0) || !(loadWatts > 0)) return null;
  return (wattHours * efficiency) / loadWatts;
}

const NUMBER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatNumber(n) {
  return NUMBER.format(Math.round(n));
}

export function formatWatts(n) {
  return `${formatNumber(n)} W`;
}

/** Friendly runtime: "About 45 min", "About 6 h 30 min", "About 3.5 days". */
export function formatDuration(hours) {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return '';
  if (hours >= 48) {
    const days = Math.round((hours / 24) * 2) / 2;
    return `About ${days % 1 === 0 ? days.toFixed(0) : days.toFixed(1)} days`;
  }
  const totalMin = Math.max(5, Math.round((hours * 60) / 5) * 5);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `About ${m} min`;
  if (m === 0) return `About ${h} h`;
  return `About ${h} h ${m} min`;
}

/**
 * Words for a verdict. Titles and subs match the app's GlowHero wording;
 * `badge` is the short web label.
 */
export function verdictCopy(v, left, peak) {
  switch (v) {
    case 'need-size':
      return { tone: 'muted', badge: '', title: 'Set size', sub: 'If two numbers, use the smaller one' };
    case 'empty':
      return { tone: 'muted', badge: '', title: 'Add what you need', sub: 'Tap what you would run at the same time.' };
    case 'over':
      return { tone: 'bad', badge: 'Too much', title: `${formatNumber(Math.abs(left ?? 0))} W over`, sub: 'Too much to run at once' };
    case 'tight':
      return { tone: 'warn', badge: 'Tight', title: `${formatNumber(left ?? 0)} W left`, sub: 'Close to the limit. Leave a little room.' };
    case 'surge':
      return {
        tone: 'warn',
        badge: 'May trip on start',
        title: `${formatNumber(left ?? 0)} W left`,
        sub: `Starting needs about ${formatNumber(peak)} W. It may trip.`,
      };
    default:
      return { tone: 'good', badge: 'Fits', title: `${formatNumber(left ?? 0)} W left`, sub: 'Looks like it can take this' };
  }
}
