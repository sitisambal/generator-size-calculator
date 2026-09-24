// A plan lives in the link's #hash, never on a server and never in storage.
//
//   #i=fridge_freezer.2_lights&c=250.1200.1.Shop%20fridge&g=3000.3500.1&wh=1024
//
//   i   stock items, "_"-separated, "id" or "id.qty"
//   c   one custom item per param: running.starting.qty.name (name last, may hold dots)
//   g   your generator: running.starting.units (starting 0 = unknown, units 1 or 2)
//   wh  power station capacity in watt-hours
//
// Anything malformed is dropped, never trusted. Names are shown with textContent only.

import { MAX_QTY, MAX_WATTS } from './calc.js';

export const MAX_CUSTOM = 20;
export const MAX_NAME = 40;

const int = (value, min, max) => {
  if (!/^\d{1,6}$/.test(String(value))) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
};

export function encodePlan(state) {
  const params = new URLSearchParams();
  const stock = state.items
    .filter((row) => row.qty > 0)
    .map((row) => (row.qty > 1 ? `${row.id}.${row.qty}` : row.id));
  if (stock.length) params.set('i', stock.join('_'));
  for (const row of state.custom) {
    if (row.qty > 0) params.append('c', `${row.running}.${row.starting}.${row.qty}.${row.name}`);
  }
  const g = state.generator ?? {};
  if (g.running > 0) params.set('g', `${g.running}.${g.starting > 0 ? g.starting : 0}.${g.parallel ? 2 : 1}`);
  if (state.wh > 0) params.set('wh', String(state.wh));
  return params.toString();
}

/** Returns null when the hash holds no plan (for example "#safety"). */
export function decodePlan(hash, knownIds) {
  const raw = String(hash ?? '').replace(/^#/, '');
  if (!raw || !/(^|&)(i|c|g|wh)=/.test(raw)) return null;

  let params;
  try {
    params = new URLSearchParams(raw);
  } catch {
    return null;
  }

  const known = new Set(knownIds);
  const seen = new Set();
  const items = [];
  for (const token of (params.get('i') ?? '').split('_')) {
    const [id, qtyText] = token.split('.');
    if (!known.has(id) || seen.has(id)) continue;
    const qty = qtyText === undefined ? 1 : int(qtyText, 1, MAX_QTY);
    if (qty == null) continue;
    seen.add(id);
    items.push({ id, qty });
  }

  const custom = [];
  for (const value of params.getAll('c').slice(0, MAX_CUSTOM)) {
    const parts = value.split('.');
    if (parts.length < 4) continue;
    const running = int(parts[0], 1, MAX_WATTS);
    const starting = int(parts[1], 1, MAX_WATTS);
    const qty = int(parts[2], 1, MAX_QTY);
    const name = parts.slice(3).join('.').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
    if (running == null || starting == null || qty == null || !name) continue;
    custom.push({ name, running, starting: Math.max(running, starting), qty });
  }

  let generator = { running: null, starting: null, parallel: false };
  const g = (params.get('g') ?? '').split('.');
  if (g.length === 3) {
    const running = int(g[0], 1, MAX_WATTS);
    const starting = int(g[1], 0, MAX_WATTS);
    const units = int(g[2], 1, 2);
    if (running != null && starting != null && units != null) {
      generator = { running, starting: starting > 0 ? starting : null, parallel: units === 2 };
    }
  }

  const wh = params.has('wh') ? int(params.get('wh'), 1, MAX_WATTS) : null;

  return { items, custom, generator, wh };
}
