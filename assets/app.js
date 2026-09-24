// Page behavior. All math lives in calc.js (mirrors the iPhone app); this file only
// keeps the list, draws it, and talks to the person. Nothing is stored or sent:
// a plan leaves this page only when someone shares or prints it.

import { APPLIANCES, GROUPS, KITS, applianceById } from './appliances.js';
import {
  INVERTER_EFFICIENCY,
  MAX_QTY,
  cleanNumber,
  formatDuration,
  formatNumber,
  parseCustomItem,
  parseWatts,
  plan,
  runtimeHours,
  verdictCopy,
} from './calc.js';
import { closeAppPromo, initAppDemo, initAppPromo } from './app-promo.js';
import { MAX_CUSTOM, decodePlan, encodePlan } from './plan-link.js';

document.documentElement.classList.add('js');

// ------------------------------------------------------------------ helpers

const $ = (id) => document.getElementById(id);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const SVG = 'http://www.w3.org/2000/svg';
const DEFAULT_WH = 1024;
const CYCLING = new Set(['fridge', 'freezer', 'cooler']);

function icon(name, cls = 'ico') {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(SVG, 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

/** Tiny element builder. Text always goes through textContent, never HTML. */
function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) if (child != null) node.append(child);
  return node;
}

const w = (n) => `${formatNumber(n)} W`;

/** Same sentence the app shows under SIZE TO BUY. */
const buyAdvice = (size) =>
  size.standby ? 'That is standby size, so have an electrician size and install it.' : 'Look for both numbers on the generator label.';

/** "the fridge", "the RV air conditioner", "the Starlink". */
function theName(name) {
  const keep = /^[A-Z]{2}/.test(name) || /^Starlink/.test(name);
  return `the ${keep ? name : name.charAt(0).toLowerCase() + name.slice(1)}`;
}

// -------------------------------------------------------------------- state

const state = {
  rows: [], // { key, kind: 'stock' | 'custom', id?, name, running, starting, icon, qty }
  generator: { running: null, starting: null, parallel: false },
  ps: { wh: DEFAULT_WH, w: null, linked: true },
};
let customSeq = 0;
let lastPlan = plan([]);

const stockRow = (id) => state.rows.find((r) => r.key === `s:${id}`);

function makeStock(id, qty = 1) {
  const a = applianceById(id);
  return { key: `s:${id}`, kind: 'stock', id, name: a.name, running: a.running, starting: a.starting, icon: a.icon, qty };
}

function makeCustom(item, qty = 1) {
  customSeq += 1;
  return { key: `c:${customSeq}`, kind: 'custom', name: item.name, running: item.running, starting: item.starting, icon: 'plug', qty };
}

const snapshot = () => state.rows.map((r) => ({ ...r }));

// --------------------------------------------------------------- the chips

const chipByid = new Map();
const groupCounts = new Map();

function buildKits() {
  const row = $('kits');
  for (const kit of KITS) {
    const btn = h('button', { type: 'button', class: 'kit', title: `Load: ${kit.ids.map((id) => applianceById(id).name).join(', ')}` });
    btn.append(icon(kit.icon), h('span', { text: kit.name }));
    btn.addEventListener('click', () => applyKit(kit));
    row.append(btn);
  }
}

function buildGroups() {
  const root = $('groups');
  for (const group of GROUPS) {
    const items = APPLIANCES.filter((a) => a.group === group.id);
    const titleId = `g-${group.id}`;
    const count = h('span', { class: 'group-count', hidden: true });
    groupCounts.set(group.id, count);
    const title = h('h4', { class: 'group-title', id: titleId }, h('span', { text: group.name }), count);
    const list = h('ul', { class: 'chips', 'aria-labelledby': titleId });
    for (const a of items) {
      const qty = h('span', { class: 'chip-qty', 'aria-hidden': 'true' });
      const btn = h(
        'button',
        {
          type: 'button',
          class: 'chip',
          'aria-pressed': 'false',
          'data-id': a.id,
          title: `${a.name}: ${w(a.running)} running${a.starting > a.running ? `, about ${w(a.starting)} to start` : ''}`,
        },
        icon(a.icon),
        h('span', { text: a.name }),
        qty
      );
      btn.addEventListener('click', () => toggle(a.id, btn));
      btn.addEventListener('animationend', () => btn.classList.remove('pop'));
      chipByid.set(a.id, { btn, qty });
      list.append(h('li', {}, btn));
    }
    const section = h('div', { class: 'group' }, title, list);
    if (group.id === 'medical') {
      section.append(
        h('p', {
          class: 'group-note',
          text: 'Another device? Add it below with the watts on its label. If someone depends on powered medical equipment, plan a backup with the supplier, and ask your utility whether it keeps a medical priority list.',
        })
      );
    }
    root.append(section);
  }
}

function syncChips() {
  const perGroup = new Map();
  for (const a of APPLIANCES) {
    const row = stockRow(a.id);
    const { btn, qty } = chipByid.get(a.id);
    const on = Boolean(row);
    btn.setAttribute('aria-pressed', String(on));
    if (on && row.qty > 1) {
      qty.textContent = String(row.qty);
      qty.classList.add('is-on');
      btn.setAttribute('aria-label', `${a.name}, ${row.qty} in your list`);
    } else {
      qty.classList.remove('is-on');
      qty.textContent = '';
      btn.removeAttribute('aria-label');
    }
    if (on) perGroup.set(a.group, (perGroup.get(a.group) ?? 0) + 1);
  }
  for (const [groupId, node] of groupCounts) {
    const n = perGroup.get(groupId) ?? 0;
    node.hidden = n === 0;
    node.textContent = String(n);
    node.setAttribute('aria-label', `${n} selected`);
  }
}

// -------------------------------------------------------------- list edits

function toggle(id, btn) {
  const existing = stockRow(id);
  if (existing) {
    state.rows = state.rows.filter((r) => r !== existing);
  } else {
    state.rows.push(makeStock(id));
    if (btn && !reduceMotion.matches) {
      btn.classList.remove('pop');
      void btn.offsetWidth; // restart the animation
      btn.classList.add('pop');
    }
  }
  update();
}

function setQty(key, qty) {
  const row = state.rows.find((r) => r.key === key);
  if (!row) return;
  const next = Math.max(0, Math.min(MAX_QTY, qty));
  if (next === 0) state.rows = state.rows.filter((r) => r !== row);
  else row.qty = next;
  update();
}

function applyKit(kit) {
  const before = snapshot();
  state.rows = kit.ids.map((id) => makeStock(id));
  update();
  toast(`${kit.name} loaded: ${kit.ids.length} things`, before.length ? () => restore(before) : null);
}

function clearAll() {
  const before = snapshot();
  if (!before.length) return;
  state.rows = [];
  update();
  toast('List cleared', () => restore(before));
  $('list-title').focus();
}

function restore(rows) {
  state.rows = rows.map((r) => ({ ...r }));
  update();
}

// ------------------------------------------------------------ list drawing

const rowNodes = new Map();

/** "200 W running" and, for motors, "1,200 W to start" as a second part. */
function rowMeta(row) {
  const run = row.qty > 1 ? `${w(row.qty * row.running)} running (${row.qty} × ${w(row.running)})` : `${w(row.running)} running`;
  const parts = [h('span', { class: 'm-run', text: run })];
  if (row.starting > row.running) parts.push(h('span', { class: 'm-kick', text: `${w(row.starting)} to start` }));
  return parts;
}

function buildRow(row) {
  const minus = h('button', { type: 'button' });
  const plus = h('button', { type: 'button', 'aria-label': `One more ${row.name}` }, icon('plus'));
  const out = h('output', {});
  const meta = h('span', { class: 'row-meta' });
  const li = h(
    'li',
    { class: 'row is-new', 'data-key': row.key },
    h('span', { class: 'row-ico', 'aria-hidden': 'true' }, icon(row.icon)),
    h('div', { class: 'row-text' }, h('span', { class: 'row-name', text: row.name }), meta),
    h('div', { class: 'stepper', role: 'group', 'aria-label': `How many: ${row.name}` }, minus, out, plus)
  );
  li.addEventListener('animationend', () => li.classList.remove('is-new'));
  minus.addEventListener('click', () => {
    const current = state.rows.find((r) => r.key === row.key);
    if (!current) return;
    if (current.qty <= 1) removeWithFocus(row.key);
    else setQty(row.key, current.qty - 1);
  });
  plus.addEventListener('click', () => {
    const current = state.rows.find((r) => r.key === row.key);
    if (current) setQty(row.key, current.qty + 1);
  });
  return { li, minus, plus, out, meta };
}

/** Removing a row deletes the focused button, so move focus somewhere sensible. */
function removeWithFocus(key) {
  const index = state.rows.findIndex((r) => r.key === key);
  setQty(key, 0);
  const next = state.rows[index] ?? state.rows[index - 1];
  const target = next ? rowNodes.get(next.key)?.minus : $('list-title');
  target?.focus();
}

function drawList() {
  const list = $('list');
  const keys = new Set(state.rows.map((r) => r.key));
  for (const [key, nodes] of rowNodes) {
    if (!keys.has(key)) {
      nodes.li.remove();
      rowNodes.delete(key);
    }
  }
  state.rows.forEach((row, index) => {
    let nodes = rowNodes.get(row.key);
    if (!nodes) {
      nodes = buildRow(row);
      rowNodes.set(row.key, nodes);
    }
    if (list.children[index] !== nodes.li) list.insertBefore(nodes.li, list.children[index] ?? null);
    nodes.out.textContent = String(row.qty);
    nodes.meta.replaceChildren(...rowMeta(row));
    const last = row.qty <= 1;
    nodes.minus.replaceChildren(icon(last ? 'trash-2' : 'minus'));
    nodes.minus.classList.toggle('is-remove', last);
    nodes.minus.setAttribute('aria-label', last ? `Remove ${row.name}` : `One fewer ${row.name}`);
    nodes.plus.disabled = row.qty >= MAX_QTY;
  });

  const things = state.rows.reduce((n, r) => n + r.qty, 0);
  $('list-empty').hidden = state.rows.length > 0;
  $('clear').hidden = state.rows.length === 0;
  $('list-count').textContent = things ? `· ${things}` : '';
}

// -------------------------------------------------------- animated numbers

const shown = new WeakMap();
const frames = new WeakMap();

function animateNumber(node, to) {
  const from = shown.get(node) ?? 0;
  cancelAnimationFrame(frames.get(node));
  if (from === to || reduceMotion.matches || document.hidden) {
    shown.set(node, to);
    node.textContent = formatNumber(to);
    return;
  }
  const start = performance.now();
  const duration = 560;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - t) ** 3;
    const value = from + (to - from) * eased;
    shown.set(node, t < 1 ? value : to);
    node.textContent = formatNumber(t < 1 ? value : to);
    if (t < 1) frames.set(node, requestAnimationFrame(tick));
  };
  frames.set(node, requestAnimationFrame(tick));
}

const numNodes = {};
for (const node of document.querySelectorAll('[data-num]')) numNodes[node.dataset.num] = node;

// ------------------------------------------------------------- plan drawing

function drawPlan(p) {
  animateNumber(numNodes.running, p.running);
  animateNumber(numNodes.kick, p.extraStart);
  animateNumber(numNodes.peak, p.peak);
  document.querySelector('.stats').classList.toggle('is-long', p.peak >= 10000);
  $('kick-from').textContent = p.kickRow ? `from ${theName(p.kickRow.name).slice(4)}` : state.rows.length ? 'no motors' : 'no motors yet';

  // Size to buy: the two numbers on a generator label (same words as the app).
  const buy = $('buy');
  const size = p.size;
  buy.dataset.state = size ? (size.standby ? 'standby' : 'ok') : 'empty';
  if (size) {
    animateNumber(numNodes.needRun, size.running);
    animateNumber(numNodes.needStart, size.starting);
    $('buy-class').textContent = buyAdvice(size);
  }

  // Meter: against your generator if typed, else against the running size above,
  // which lands just under the 80% notch and shows why that size was picked.
  if (size) {
    let ref;
    let label;
    let tone = 'good';
    if (p.cap) {
      ref = p.cap;
      label = state.generator.parallel ? `Load on your two generators (${w(p.cap)})` : `Load on your ${w(p.cap)} generator`;
      tone = { ok: 'good', tight: 'warn', surge: 'warn', over: 'bad' }[p.verdict] ?? 'good';
    } else {
      ref = size.running;
      label = `Load on a generator that runs ${w(size.running)}`;
    }
    const ratio = p.running / ref;
    const pct = Math.round(ratio * 100);
    const meter = $('meter');
    meter.dataset.tone = tone;
    meter.style.setProperty('--fill', String(Math.min(1, ratio)));
    $('meter-label').textContent = label;
    $('meter-pct').textContent = `${pct}%`;
    $('meter-track').setAttribute('aria-label', `${pct}% of ${w(ref)} running capacity. Staying under 80% is the comfortable limit.`);
  }

  // Your generator
  const verdictBox = $('verdict');
  if (p.verdict === 'need-size') {
    verdictBox.hidden = true;
  } else {
    const copy = verdictCopy(p.verdict, p.left, p.peak);
    const changed = verdictBox.hidden || verdictBox.dataset.verdict !== p.verdict;
    verdictBox.hidden = false;
    verdictBox.dataset.tone = copy.tone;
    verdictBox.dataset.verdict = p.verdict;
    $('v-badge').textContent = copy.badge;
    $('v-title').textContent = copy.title;
    $('v-sub').textContent = copy.sub;
    let start = '';
    if (p.running > 0 && p.verdict !== 'over') {
      const whose = state.generator.parallel ? 'your pair gives' : 'yours gives';
      const note = state.generator.starting ? '' : ' (its running rating, since starting is blank)';
      start = `Starting: about ${w(p.peak)} needed, ${whose} ${w(p.startLimit)}${note}.`;
    }
    $('v-start').textContent = start;
    if (changed && !reduceMotion.matches) {
      verdictBox.classList.remove('is-changed');
      void verdictBox.offsetWidth;
      verdictBox.classList.add('is-changed');
    }
  }

  // Start-order tip
  const tip = $('tip');
  tip.hidden = !p.kickRow;
  if (p.kickRow) {
    const others = state.rows.length > 1 ? ', then switch the rest on one at a time' : '';
    $('tip-text').textContent = `Start ${theName(p.kickRow.name)} first${others}. Starting two motors at once is what trips a generator.`;
  }

  // Mobile dock
  $('dock-v').textContent = size ? `${w(size.running)} run · ${w(size.starting)} start` : '';
}

// ---------------------------------------------------------- power station

function drawRuntime(p) {
  const input = $('ps-w');
  const hasList = p.running > 0;
  if (state.ps.linked) {
    state.ps.w = hasList ? p.running : null;
    if (document.activeElement !== input) input.value = hasList ? formatNumber(p.running) : '';
  }
  const following = state.ps.linked && hasList;
  $('ps-linked').hidden = !following;
  const use = $('ps-use');
  use.hidden = following || !hasList;
  use.textContent = `Use my list (${w(p.running)})`;
  $('ps-eg').hidden = following;

  for (const btn of document.querySelectorAll('.presets button')) {
    btn.setAttribute('aria-pressed', String(Number(btn.dataset.wh) === state.ps.wh));
  }

  const hours = runtimeHours(state.ps.wh, state.ps.w);
  const out = $('ps-out');
  out.dataset.state = hours == null ? 'empty' : 'ok';
  if (hours == null) {
    $('ps-time').textContent = state.ps.wh ? 'Enter a load' : 'Enter a capacity';
    $('ps-math').textContent = `Capacity × ${Math.round(INVERTER_EFFICIENCY * 100)}% ÷ load`;
    $('day-fill').parentElement.style.setProperty('--fill', '0');
  } else {
    $('ps-time').textContent = formatDuration(hours);
    const hText = hours.toFixed(1);
    $('ps-math').textContent = `${formatNumber(state.ps.wh)} Wh × 85% ÷ ${w(state.ps.w)} ≈ ${hText} h`;
    $('day-fill').parentElement.style.setProperty('--fill', String(Math.min(1, hours / 24)));
  }

  $('ps-kick').textContent = following
    ? `A power station must also cover the starting kick. For your list: at least ${w(p.running)} of output, and a surge rating of at least ${w(p.peak)}.`
    : 'A power station must also cover the starting kick: its output rating has to carry your running watts, and its surge rating your peak.';
  $('ps-fridge').hidden = !(following && state.rows.some((r) => CYCLING.has(r.id)));
}

// ----------------------------------------------------------------- update

let announceTimer = 0;
let quiet = true;

function update() {
  const p = plan(state.rows, state.generator);
  lastPlan = p;
  syncChips();
  drawList();
  drawPlan(p);
  drawRuntime(p);
  syncDock();
  if (!quiet) {
    // Someone is building a plan: the app card has had its moment.
    if (state.rows.length) closeAppPromo();
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => announce(p), 700);
  }
}

function announce(p) {
  const region = $('announce');
  if (!p.size) {
    region.textContent = 'Your list is empty.';
    return;
  }
  const things = state.rows.reduce((n, r) => n + r.qty, 0);
  let text = `${things} ${things === 1 ? 'thing' : 'things'}. Running ${formatNumber(p.running)} watts, peak ${formatNumber(p.peak)} watts. Size to buy: at least ${formatNumber(p.size.running)} watts running and ${formatNumber(p.size.starting)} watts starting.`;
  if (p.verdict !== 'need-size') {
    const c = verdictCopy(p.verdict, p.left, p.peak);
    text += ` Your generator: ${c.badge || c.title}. ${c.badge ? c.title : ''}`;
  }
  region.textContent = text.trim();
}

// ------------------------------------------------------------------- dock

// The dock shows the answer only while someone is tapping chips. It hides at the
// custom form and list so it never sits on top of their buttons.
let chipsInView = false;
let planInView = false;

function syncDock() {
  const on = chipsInView && !planInView && state.rows.length > 0;
  if (on) closeAppPromo();
  const dock = $('dock');
  dock.classList.toggle('is-on', on);
  dock.toggleAttribute('inert', !on);
}

function watchDock() {
  if (!('IntersectionObserver' in window)) return;
  new IntersectionObserver(
    ([entry]) => {
      chipsInView = entry.isIntersecting;
      syncDock();
    },
    { rootMargin: '0px 0px -96px 0px', threshold: 0 }
  ).observe($('groups'));
  new IntersectionObserver(
    ([entry]) => {
      planInView = entry.isIntersecting;
      syncDock();
    },
    { rootMargin: '0px 0px -30% 0px', threshold: 0 }
  ).observe($('plan'));
}

// ------------------------------------------------------------------- toast

let toastTimer = 0;
let undoFn = null;

function toast(message, onUndo = null) {
  const box = $('toast');
  const undo = $('toast-undo');
  $('toast-text').textContent = message;
  undoFn = onUndo;
  undo.hidden = !onUndo;
  box.classList.toggle('no-action', !onUndo);
  box.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, onUndo ? 6000 : 3200);
}

function hideToast() {
  $('toast').classList.remove('is-on');
  undoFn = null;
}

// ------------------------------------------------------------- custom item

function openCustom(open) {
  const form = $('custom-form');
  form.hidden = !open;
  $('custom-toggle').setAttribute('aria-expanded', String(open));
  if (open) $('c-name').focus();
}

function submitCustom(event) {
  event.preventDefault();
  const name = $('c-name');
  const run = $('c-run');
  const start = $('c-start');
  const error = $('c-error');
  for (const field of [name, run, start]) field.removeAttribute('aria-invalid');

  const fail = (field, message) => {
    field.setAttribute('aria-invalid', 'true');
    error.textContent = message;
    field.focus();
  };

  if (state.rows.filter((r) => r.kind === 'custom').length >= MAX_CUSTOM) {
    return fail(name, `That’s ${MAX_CUSTOM} of your own items, the most one plan holds.`);
  }
  if (!name.value.trim()) return fail(name, 'Give it a name.');
  const item = parseCustomItem(name.value.replace(/\s+/g, ' '), cleanNumber(run.value), cleanNumber(start.value));
  if (!item) {
    const runOk = parseWatts(run.value) != null;
    return runOk ? fail(start, 'Starting watts should be a number, or leave it blank.') : fail(run, 'Enter its running watts, like 250.');
  }
  if (item.running > 100000 || item.starting > 100000) return fail(run, 'That’s more than 100,000 W. Check the number.');

  error.textContent = '';
  state.rows.push(makeCustom({ ...item, name: item.name.slice(0, 40) }));
  update();
  $('custom-form').reset();
  openCustom(false);
  $('custom-toggle').focus();
  toast(`Added ${item.name.slice(0, 40)}`);
}

// ---------------------------------------------------------- number fields

function bindWatts(input, onValue) {
  input.addEventListener('input', () => onValue(parseWatts(input.value)));
  input.addEventListener('blur', () => {
    const n = parseWatts(input.value);
    if (n != null) input.value = formatNumber(n);
  });
}

function bindInputs() {
  bindWatts($('g-run'), (n) => {
    state.generator.running = n;
    update();
  });
  bindWatts($('g-start'), (n) => {
    state.generator.starting = n;
    update();
  });
  $('g-parallel').addEventListener('change', (e) => {
    state.generator.parallel = e.target.checked;
    update();
  });

  bindWatts($('ps-wh'), (n) => {
    state.ps.wh = n;
    update();
  });
  bindWatts($('ps-w'), (n) => {
    state.ps.linked = false;
    state.ps.w = n;
    update();
  });
  $('ps-use').addEventListener('click', () => {
    state.ps.linked = true;
    update();
  });
  for (const btn of document.querySelectorAll('.presets button')) {
    btn.addEventListener('click', () => {
      state.ps.wh = Number(btn.dataset.wh);
      $('ps-wh').value = formatNumber(state.ps.wh);
      update();
    });
  }
}

// ------------------------------------------------------------ share / print

function linkState() {
  return {
    items: state.rows.filter((r) => r.kind === 'stock').map((r) => ({ id: r.id, qty: r.qty })),
    custom: state.rows.filter((r) => r.kind === 'custom').map(({ name, running, starting, qty }) => ({ name, running, starting, qty })),
    generator: state.generator,
    wh: state.ps.wh && state.ps.wh !== DEFAULT_WH ? state.ps.wh : null,
  };
}

// The hash this page last wrote itself. Coming back to it (Back after a nav link)
// must not reload an older copy of the plan over newer edits.
let ownHash = '';

async function share() {
  if (!state.rows.length) {
    toast('Add something first, then share your plan.');
    return;
  }
  const hash = encodePlan(linkState());
  const url = `${location.origin}${location.pathname}#${hash}`;
  ownHash = hash;
  history.replaceState(null, '', `#${hash}`);
  const p = lastPlan;
  const text = `My generator plan: at least ${w(p.size.running)} running and ${w(p.size.starting)} starting.`;
  if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ title: 'My generator plan', text, url });
      return;
    } catch (error) {
      if (error && error.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied. It holds your whole list.');
  } catch {
    window.prompt('Copy this link to your plan:', url);
  }
}

function buildPrintSheet() {
  const p = plan(state.rows, state.generator);
  const sheet = $('print-sheet');
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const page = `${location.origin}${location.pathname}`.replace(/^null/, '');
  const parts = [h('h1', { text: 'Generator plan' }), h('p', { class: 'p-meta', text: `Made ${date}${page ? ` · ${page}` : ''}` })];

  if (state.rows.length) {
    const body = h('tbody');
    for (const r of state.rows) {
      body.append(
        h(
          'tr',
          {},
          h('td', { text: r.name }),
          h('td', { class: 'n', text: String(r.qty) }),
          h('td', { class: 'n', text: w(r.running * r.qty) }),
          h('td', { class: 'n', text: r.starting > r.running ? w(r.starting) : '–' })
        )
      );
    }
    const foot = h(
      'tfoot',
      {},
      h('tr', {}, h('th', { colspan: '2', text: 'Running, all at once' }), h('td', { class: 'n', text: w(p.running) }), h('td')),
      h(
        'tr',
        {},
        h('th', { colspan: '2', text: `Biggest start${p.kickRow ? ` (${p.kickRow.name})` : ''}` }),
        h('td', { class: 'n', text: `+${w(p.extraStart)}` }),
        h('td')
      ),
      h('tr', {}, h('th', { colspan: '2', text: 'Peak' }), h('td', { class: 'n', text: w(p.peak) }), h('td'))
    );
    parts.push(
      h(
        'table',
        {},
        h('thead', {}, h('tr', {}, h('th', { text: 'What runs' }), h('th', { class: 'n', text: 'How many' }), h('th', { class: 'n', text: 'Running' }), h('th', { class: 'n', text: 'Starting, each' }))),
        body,
        foot
      )
    );
    parts.push(h('h2', { text: 'Size to buy' }));
    parts.push(
      h('p', {
        class: 'p-buy',
        text: `At least ${w(p.size.running)} running and ${w(p.size.starting)} starting. ${buyAdvice(p.size)}`,
      })
    );
    if (p.verdict !== 'need-size') {
      const c = verdictCopy(p.verdict, p.left, p.peak);
      const g = state.generator;
      const spec = `${g.parallel ? 'Two linked, ' : ''}${w(g.running)} running${g.starting ? `, ${w(g.starting)} starting` : ''}`;
      parts.push(h('h2', { text: 'Your generator' }), h('p', { text: `${spec}. ${c.badge ? `${c.badge}: ` : ''}${c.title}. ${c.sub}` }));
    }
  } else {
    parts.push(h('p', { text: 'Your list is empty. Add what you would run at the same time, then print again.' }));
  }

  const steps = h('ul');
  if (p.kickRow) steps.append(h('li', { text: `Start ${theName(p.kickRow.name)} first, then switch the rest on one at a time.` }));
  for (const line of [
    'Run the generator outdoors only, at least 20 feet from windows, doors and vents, exhaust pointed away. Never in a garage, even with the door open.',
    'Keep battery or battery-backup CO alarms working inside. Feel sick, dizzy or weak? Get to fresh air right away, then call 911.',
    'Never plug the generator into a wall outlet (backfeeding). Home circuits need a transfer switch or interlock installed by a licensed electrician.',
    'Turn it off and let it cool before refueling.',
  ]) {
    steps.append(h('li', { text: line }));
  }
  parts.push(h('h2', { text: 'Before you start it' }), steps);
  parts.push(h('p', { class: 'p-foot', text: 'Typical watts for planning; real appliances vary. Offline on iPhone: Generator Load Check on the App Store.' }));
  sheet.replaceChildren(...parts);
}

// --------------------------------------------------------------- restore

function loadFromHash(hash, { announceLoad } = {}) {
  const decoded = decodePlan(hash, APPLIANCES.map((a) => a.id));
  if (!decoded) return false;
  state.rows = [...decoded.items.map((i) => makeStock(i.id, i.qty)), ...decoded.custom.map((c) => makeCustom(c, c.qty))];
  state.generator = { ...decoded.generator };
  $('g-run').value = decoded.generator.running ? formatNumber(decoded.generator.running) : '';
  $('g-start').value = decoded.generator.starting ? formatNumber(decoded.generator.starting) : '';
  $('g-parallel').checked = decoded.generator.parallel;
  if (decoded.wh) {
    state.ps.wh = decoded.wh;
    $('ps-wh').value = formatNumber(decoded.wh);
  }
  state.ps.linked = true;
  if (announceLoad) toast('Loaded a shared plan');
  return true;
}

// -------------------------------------------------------------- wire up

function revealArt() {
  const art = document.querySelector('.kick-art');
  if (!art) return;
  if (!('IntersectionObserver' in window) || reduceMotion.matches) {
    art.classList.add('is-seen');
    return;
  }
  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        art.classList.add('is-seen');
        io.disconnect();
      }
    },
    { threshold: 0.4 }
  );
  io.observe(art);
}

function init() {
  buildKits();
  buildGroups();
  bindInputs();

  $('custom-toggle').addEventListener('click', () => openCustom($('custom-form').hidden));
  $('custom-cancel').addEventListener('click', () => {
    $('custom-form').reset();
    $('c-error').textContent = '';
    openCustom(false);
    $('custom-toggle').focus();
  });
  $('custom-form').addEventListener('submit', submitCustom);
  $('custom-form').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') $('custom-cancel').click();
  });
  $('clear').addEventListener('click', clearAll);
  $('list-title').setAttribute('tabindex', '-1');
  $('share').addEventListener('click', share);
  $('print').addEventListener('click', () => {
    buildPrintSheet();
    window.print();
  });
  window.addEventListener('beforeprint', buildPrintSheet);
  $('toast-undo').addEventListener('click', () => {
    const fn = undoFn;
    hideToast();
    fn?.();
  });
  window.addEventListener('hashchange', () => {
    if (location.hash.slice(1) === ownHash) return;
    if (loadFromHash(location.hash, { announceLoad: true })) update();
  });

  loadFromHash(location.hash, { announceLoad: true });
  update();
  quiet = false;
  watchDock();
  revealArt();
  initAppDemo(reduceMotion);
  initAppPromo(reduceMotion);
}

init();
