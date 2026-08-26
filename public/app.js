const CURRENCIES = {
  USD: { symbol: '$', rate: 1 },
  INR: { symbol: '\u20B9', rate: 83.5 },
  GBP: { symbol: '\u00A3', rate: 0.79 },
  AUD: { symbol: 'A$', rate: 1.52 },
};

function fmt(usd) {
  const { symbol, rate } = CURRENCIES[state.currency];
  const converted = usd * rate;
  return symbol + converted.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const state = {
  subs: [],
  activeCategory: 'all',
  search: '',
  currency: localStorage.getItem('currency') || 'USD',
};

function normalizeMonthly(cost, billingCycle) {
  if (billingCycle === 'yearly') return cost / 12;
  if (billingCycle === 'weekly') return cost * 4.33;
  return cost;
}

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const renewal = new Date(dateStr + 'T00:00:00');
  return Math.round((renewal - today) / 86400000);
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

async function load() {
  const res = await fetch('/api/subscriptions');
  state.subs = await res.json();
  render();
}

function visibleSubs() {
  let list = [...state.subs];
  if (state.activeCategory !== 'all') {
    list = list.filter(s => (s.category || 'Uncategorized') === state.activeCategory);
  }
  if (state.search) {
    const q = state.search.toLowerCase();
    list = list.filter(s => s.name.toLowerCase().includes(q));
  }
  list.sort((a, b) => a.nextRenewalDate.localeCompare(b.nextRenewalDate));
  return list;
}

function renderCategories() {
  const container = document.getElementById('category-pills');
  const cats = [...new Set(state.subs.map(s => s.category).filter(Boolean))].sort();
  container.innerHTML = '';
  const allBtn = pillButton('All', 'all');
  container.appendChild(allBtn);
  cats.forEach(cat => container.appendChild(pillButton(cat, cat)));
}

function pillButton(label, value) {
  const btn = document.createElement('button');
  btn.className = 'pill' + (state.activeCategory === value ? ' active' : '');
  btn.textContent = label;
  btn.dataset.value = value;
  return containerPillHandler(btn);
}

function containerPillHandler(btn) {
  btn.addEventListener('click', () => {
    state.activeCategory = btn.dataset.value;
    render();
  });
  return btn;
}

function renderTotal() {
  const total = state.subs.reduce((sum, s) => sum + normalizeMonthly(s.cost, s.billingCycle), 0);
  const el = document.getElementById('total');
  animateCount(el, total);
}

function animateCount(el, target) {
  const start = parseFloat(el.dataset.value || 0);
  el.dataset.value = target;
  const duration = 400;
  const t0 = performance.now();
  function tick(t) {
    const p = Math.min((t - t0) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(start + (target - start) * eased);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function renderUpcoming() {
  const soon = state.subs.filter(s => {
    const d = daysUntil(s.nextRenewalDate);
    return d >= 0 && d <= 7;
  });
  const countEl = document.getElementById('upcoming-count');
  countEl.textContent = soon.length;

  const banner = document.getElementById('upcoming-banner');
  const namesEl = document.getElementById('upcoming-names');
  if (soon.length > 0) {
    banner.classList.remove('hidden');
    namesEl.textContent = soon.map(s => s.name).join(', ');
  } else {
    banner.classList.add('hidden');
  }
}

function renderList() {
  const list = document.getElementById('sub-list');
  list.innerHTML = '';
  const subs = visibleSubs();

  if (subs.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'no-subs';
    empty.textContent = state.search
      ? `No subscriptions match "${state.search}"`
      : 'No subscriptions yet. Add one above!';
    list.appendChild(empty);
    return;
  }

  subs.forEach((sub, i) => {
    const days = daysUntil(sub.nextRenewalDate);
    const soon = days >= 0 && days <= 7;
    const cancelled = !!sub.cancelCandidate;

    const li = document.createElement('li');
    li.className = 'sub-item' + (soon ? ' upcoming-renewal' : '') + (cancelled ? ' cancel-candidate' : '');
    li.style.animationDelay = (i * 40) + 'ms';

    let countdown;
    if (days < 0) countdown = `renewed ${-days} day${days === -1 ? '' : 's'} ago`;
    else if (days === 0) countdown = 'renews today';
    else if (days === 1) countdown = 'renews tomorrow';
    else countdown = `renews in ${days} days`;

    li.innerHTML = `
      <div class="sub-info">
        <div class="name-row">
          <span class="name">${escapeHtml(sub.name)}</span>
          ${sub.category ? `<span class="tag">${escapeHtml(sub.category)}</span>` : ''}
          ${soon ? '<span class="badge">renewing soon</span>' : ''}
          ${cancelled ? '<span class="badge cancel-badge">cancelling?</span>' : ''}
        </div>
        <div class="details">${fmt(sub.cost)} / ${sub.billingCycle} &bull; ${countdown} (${formatDate(sub.nextRenewalDate)})</div>
      </div>
      <div class="sub-cost">
        <span class="monthly">${fmt(normalizeMonthly(sub.cost, sub.billingCycle))}</span>
        <span class="per">/mo</span>
      </div>
      <div class="sub-actions">
        <button class="btn btn-cancel" title="${cancelled ? 'Keep subscription' : 'Thinking of cancelling'}">${cancelled ? '&#10003;' : '!'}</button>
        <button class="btn btn-delete" title="Delete">&times;</button>
      </div>
    `;

    li.querySelector('.btn-delete').addEventListener('click', () => deleteSub(sub));
    li.querySelector('.btn-cancel').addEventListener('click', () => toggleCancel(sub));

    list.appendChild(li);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function render() {
  renderCategories();
  renderTotal();
  renderUpcoming();
  renderList();
}

function toast(message, type = 'info') {
  const container = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 2500);
}

async function addSub(sub) {
  await fetch('/api/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub),
  });
  await load();
  toast(`Added ${sub.name}`, 'success');
}

async function deleteSub(sub) {
  if (!confirm(`Remove ${sub.name}?`)) return;
  await fetch(`/api/subscriptions/${sub.id}`, { method: 'DELETE' });
  await load();
  toast(`Removed ${sub.name}`, 'danger');
}

async function toggleCancel(sub) {
  await fetch(`/api/subscriptions/${sub.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cancelCandidate: !sub.cancelCandidate }),
  });
  await load();
  toast(
    !sub.cancelCandidate
      ? `${sub.name} marked as cancel candidate`
      : `${sub.name} kept`,
    'warn'
  );
}

document.getElementById('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const sub = {
    name: form.elements['name'].value.trim(),
    cost: parseFloat(form.elements['cost'].value),
    billingCycle: form.elements['billingCycle'].value,
    nextRenewalDate: form.elements['nextRenewalDate'].value,
    category: form.elements['category'].value.trim() || null,
  };
  await addSub(sub);
  form.reset();
});

document.getElementById('search').addEventListener('input', (e) => {
  state.search = e.target.value.trim().toLowerCase();
  renderList();
});

const currencySelect = document.getElementById('currency');
currencySelect.value = state.currency;
currencySelect.addEventListener('change', (e) => {
  state.currency = e.target.value;
  localStorage.setItem('currency', state.currency);
  document.querySelector('.total-spend').dataset.value = '';
  document.getElementById('total').dataset.value = '0';
  render();
});

load();