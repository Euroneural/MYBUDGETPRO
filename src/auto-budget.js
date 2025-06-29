// Auto Budget generation logic
// Computes yearly and monthly budgets per description-based category
// Ignores statistical outliers using the IQR method
// Exports a single function `generateAutoBudget(transactions)` which returns
// { month: 'YYYY-MM', yearlyTarget: number, categories: { [category]: { yearly, monthly, outliers: [txnIds], totalSpend } } }

import { startOfMonth, format } from 'https://cdn.jsdelivr.net/npm/date-fns@2.29.3/esm/index.js';

/**
 * Calculate interquartile range and filter outliers
 * @param {number[]} values
 * @returns {object} { filtered: number[], outliers: number[] }
 */
function filterOutliers(values) {
  if (!values.length) return { filtered: [], outliers: [] };
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  const filtered = [];
  const outliers = [];
  for (const v of values) {
    if (v < lower || v > upper) outliers.push(v); else filtered.push(v);
  }
  return { filtered, outliers };
}

/**
 * Groups transactions by description (used as category if category missing) or category
 * @param {Array} txns
 * @returns {Map<string, Array>}
 */
function groupByCategory(txns) {
  const map = new Map();
  for (const txn of txns) {
    const key = txn.category || txn.description || 'Uncategorised';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(txn);
  }
  return map;
}

/**
 * Generate auto-budget based on past 12 months of transactions.
 * @param {Array} transactions full transaction list
 * @returns {object} auto budget object
 */
export function generateAutoBudget(transactions) {
  if (!Array.isArray(transactions)) return null;
  const now = new Date();
  const monthKey = format(startOfMonth(now), 'yyyy-MM');

  // Consider transactions from the last 12 months
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  let lastYearTxns = transactions.filter(t => {
    const d = new Date(t.date);
    return !isNaN(d) && d >= oneYearAgo;
  });
  if (lastYearTxns.length === 0) {
    // If no recent transactions, fall back to full list
    console.warn('[AutoBudget] No transactions in the last 12 months – falling back to all transactions');
    lastYearTxns = transactions;
  }

  const grouped = groupByCategory(lastYearTxns);
  const categories = {};
  let yearlyTotal = 0;

  for (const [cat, txns] of grouped.entries()) {
    const amounts = txns.map(t => Math.abs(t.amount)); // use absolute values for spending
    const { filtered, outliers } = filterOutliers(amounts);
    const yearly = filtered.reduce((sum, a) => sum + a, 0);
    const monthly = yearly / 12;
    yearlyTotal += yearly;
    categories[cat] = {
      yearly: Number(yearly.toFixed(2)),
      monthly: Number(monthly.toFixed(2)),
      outlierCount: outliers.length,
      outliers: outliers,
      totalSpend: amounts.reduce((s, a) => s + a, 0)
    };
  }

  return {
    month: monthKey,
    yearlyTarget: Number(yearlyTotal.toFixed(2)),
    categories
  };
}
