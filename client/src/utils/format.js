/**
 * Number formatting utilities per docs/design.md §6:
 * - Percentages: 1 decimal in cards, 2 decimals in tables
 * - Latency: ms below 1000 ms, seconds (2 decimals) at or above 1000 ms
 */

export function formatPercentCard(value, fallback = '—') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return fallback;
  }
  return `${Number(value).toFixed(1)}%`;
}

export function formatPercentTable(value, fallback = '—') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return fallback;
  }
  return `${Number(value).toFixed(2)}%`;
}

export function formatLatency(ms, { signed = false, fallback = '—' } = {}) {
  if (ms === null || ms === undefined || Number.isNaN(Number(ms))) {
    return fallback;
  }
  const num = Number(ms);
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : signed && num > 0 ? '+' : '';

  if (abs >= 1000) {
    return `${sign}${(abs / 1000).toFixed(2)} s`;
  }
  return `${sign}${Math.round(abs)} ms`;
}
