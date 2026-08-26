dbPath = 'subscriptions.db';

function normalizeCost(cost, billingCycle) {
  if (billingCycle === 'yearly') return (cost / 12).toFixed(2);
  if (billingCycle === 'weekly') return (cost * 4.33).toFixed(2);
  return cost.toFixed(2);
}

function isWithin7Days(dateStr) {
  const today = new Date();
  const renewal = new Date(dateStr);
  const diffDays = Math.ceil((renewal - today) / 86400000);
  return diffDays >= 0 && diffDays <= 7;
}

function getFilterParams() {
  const filter = document.querySelector('#sub-list .active-filter') ? 
    document.querySelector('#sub-list .active-filter').dataset.filter : 'all';
  if (filter === 'all') return {};
  return { category: filter };
}

async function fetchSubs(filters = {}) {
  const params = new URLSearchParams(filters);
  const res = await fetch(`/api/subscriptions?${params}`);
  return res.json();
}

function renderPills(categories) {
  const container = document.getElementById('category-pills');
  if (!categories || categories.length === 0) {
    container.innerHTML = '';
    return;
  }
  const unique = [...new Set(categories)];
  container.innerHTML = `
    <button class="filter-btn active" data-filter="all">All</button>
  `;
  unique.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'pill' + (cat === 'all' ? ' active' : '');
    btn.dataset.filter = cat;
    btn.textContent = cat;
    btn.onclick = () => {
      document.querySelectorAll('#category-pills .pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.querySelector('[data-filter="all"]').classList.add('active');
      renderSubs(filterByCat(cat));
    };
    container.appendChild(btn);
  });
}

function filterByCat(cat) {
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector('[data-filter="all"]').classList.add('active');
  document.querySelectorAll('.pill').forEach(p => {
    if (p.dataset.filter === cat) p.classList.add('active');
  });
  return { category: cat };
}

async function renderSubs(filters = {}) {
  const subs = await fetchSubs(filters);
  const list = document.getElementById('sub-list');
  list.innerHTML = '';

  const today = new Date();
  let upcomingCount = 0;

  if (subs.length === 0) {
    list.innerHTML = '<li class="no-subs">No subscriptions yet. Add one above!</li>';
    updateTotal(0);
    updateUpcomingCount(0);
    return;
  }

  // Sort by nextRenewalDate ascending
  subs.sort((a, b) => new Date(a.nextRenewalDate) - new Date(b.nextRenewalDate));

  subs.forEach(sub => {
    const monthlyCost = parseFloat(normalizeCost(sub.cost, sub.billingCycle));
    const within7 = isWithin7Days(sub.nextRenewalDate);
    if (within7) upcomingCount++;

    const li = document.createElement('li');
    li.className = 'sub-item' + (within7 ? ' upcoming-renewal' : '') + (sub.cancelCandidate ? ' cancel-candidate' : '');
    li.dataset.id = sub.id;
    li.dataset.category = sub.category || '';

    li.innerHTML = `
      <div class="sub-info">
        <div class="name${sub.cancelCandidate ? ' cancel' : ''}" title="${sub.name}">${sub.name}</div>
        <div class="details">
          $${parseFloat(sub.cost).toFixed(2)} / ${sub.billingCycle} • 
          Next: ${formatDate(sub.nextRenewalDate)}
        </div>
      </div>
      <div class="sub-cost">
        <span class="monthly">$${normalizeCost(sub.cost, sub.billingCycle)}/mo</span>
        ${sub.cost ? `<span class="original">orig: $${parseFloat(sub.cost).toFixed(2)}</span>` : ''}
      </div>
      <div class="sub-actions">
        <button class="btn btn-edit" title="Edit">✎</button>
        <button class="btn btn-delete" title="Delete">×</button>
        ${sub.cancelCandidate ? '' : `<button class="btn btn-cancel" title="Mark as cancel candidate">!</button>`}
      </div>
    `;

    li.querySelector('.btn-delete').onclick = (e) => {
      e.stopPropagation();
      if (confirm('Remove this subscription?')) {
        deleteSub(sub.id);
      }
    };

    li.querySelector('.btn-cancel').onclick = (e) => {
      e.stopPropagation();
      toggleCancel(sub.id);
    };

    list.appendChild(li);
  });

  updateTotal(subs.reduce((sum, s) => sum + parseFloat(normalizeCost(s.cost, s.billingCycle)), 0));
  updateUpcomingCount(upcomingCount);
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function updateTotal(amount) {
  const span = document.getElementById('total');
  span.textContent = `$${amount.toFixed(2)}`;
}

function updateUpcomingCount(count) {
  const span = document.getElementById('upcoming-count');
  span.textContent = count;
  const upcoming = document.querySelector('.upcoming');
  if (count > 0) {
    upcoming.style.display = 'block';
  } else {
    upcoming.style.display = 'none';
  }
}

async function toggleCancel(id) {
  const res = await fetch(`/api/subscriptions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cancelCandidate: true })
  });
  const data = await res.json();
  renderSubs(filterByCat(document.querySelector('[data-filter].active')?.dataset.filter || ''));
}

async function deleteSub(id) {
  await fetch(`/api/subscriptions/${id}`, { method: 'DELETE' });
  renderSubs(filterByCat(document.querySelector('[data-filter].active')?.dataset.filter || ''));
}

document.getElementById('add-form').onsubmit = async (e) => {
  e.preventDefault();
  const form = e.target;
  const sub = {
    name: form.name.value,
    cost: parseFloat(form.cost.value),
    billingCycle: form['billing-cycle'].value,
    nextRenewalDate: form['next-renewal'].value,
    category: form.category.value || null
  };
  await fetch('/api/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub)
  });
  form.reset();
  renderSubs(filterByCat(document.querySelector('[data-filter].active')?.dataset.filter || ''));
};

// Initialize: render on load + build category pills
document.addEventListener('DOMContentLoaded', async () => {
  // Build category pills from existing data first
  const initialSubs = await fetchSubs({});
  const cats = initialSubs.map(s => s.category).filter(Boolean);
  renderPills(cats);
  
  // Then render the full list
  renderSubs();
});

// Category filter buttons
document.querySelectorAll('.pill').forEach(pill => {
  pill.addEventListener('click', () => {
    const filter = pill.dataset.filter;
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    renderSubs(filterByCat(filter));
  });
});