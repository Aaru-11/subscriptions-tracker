const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'subscriptions.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    cost REAL NOT NULL,
    billingCycle TEXT CHECK(billingCycle IN ('weekly', 'monthly', 'yearly')) NOT NULL,
    nextRenewalDate TEXT NOT NULL,
    category TEXT,
    cancelCandidate INTEGER DEFAULT 0
  )
`);

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

  const stmt = db.prepare('INSERT INTO subscriptions (name, cost, billingCycle, nextRenewalDate, category, cancelCandidate) VALUES (?, ?, ?, ?, ?, ?)');
  for (const sub of seedSubs) {
    stmt.run(sub);
  }
}

module.exports = db;