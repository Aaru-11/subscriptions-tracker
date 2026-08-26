const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// GET /api/subscriptions
app.get('/api/subscriptions', (req, res) => {
  const rows = db.prepare('SELECT * FROM subscriptions ORDER BY nextRenewalDate').all();
  res.json(rows);
});

// POST /subscriptions
app.post('/api/subscriptions', (req, res) => {
  const { name, cost, billingCycle, nextRenewalDate, category } = req.body;
  const result = db.prepare(
    'INSERT INTO subscriptions (name, cost, billingCycle, nextRenewalDate, category, cancelCandidate) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name, cost, billingCycle, nextRenewalDate, category || null, 0);
  const row = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(result.lastInsertRowid);
  res.json(row);
});

// PUT /subscriptions/:id
app.put('/api/subscriptions/:id', (req, res) => {
  const { id } = req.params;
  const { cancelCandidate } = req.body;
  const ccValue = cancelCandidate !== undefined ? Number(cancelCandidate) : 0;
  db.prepare('UPDATE subscriptions SET cancelCandidate = ? WHERE id = ?').run(ccValue, id);
  const row = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(id);
  res.json(row);
});

// DELETE /subscriptions/:id
app.delete('/api/subscriptions/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM subscriptions WHERE id = ?').run(id);
  res.status(204).send();
});

// Seed on startup if empty
const countRow = db.prepare('SELECT COUNT(*) as cnt FROM subscriptions').get();
const count = countRow.cnt;
if (count === 0) {
  const seedSubs = [
    ['Spotify', 10.99, 'monthly', '2026-09-15', 'Music', 0],
    ['Netflix', 15.49, 'monthly', '2026-09-03', 'Entertainment', 0],
    ['Gemini', 19.99, 'monthly', '2026-08-30', 'Productivity', 0],
    ['Apple TV', 9.99, 'monthly', '2026-09-12', 'Entertainment', 0],
    ['F1 TV', 109.99, 'yearly', '2026-12-01', 'Sports', 0],
  ];
  const insert = db.prepare('INSERT INTO subscriptions (name, cost, billingCycle, nextRenewalDate, category, cancelCandidate) VALUES (?, ?, ?, ?, ?, ?)');
  for (const sub of seedSubs) {
    insert.run(sub);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});