/**
 * Currency helpers — renderer-side formatting in DZD.
 */

import { CURRENCY } from './constants';

export function formatDZD(amount: number, opts: { withSymbol?: boolean } = {}): string {
  const withSymbol = opts.withSymbol ?? true;
  const formatted = new Intl.NumberFormat(CURRENCY.LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount ?? 0);
  return withSymbol ? `${formatted} ${CURRENCY.SYMBOL}` : formatted;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(CURRENCY.LOCALE).format(value ?? 0);
}

export function formatDate(date: string | Date, opts: Intl.DateTimeFormatOptions = {}): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...opts
  }).format(d);
}

export function formatDateTime(date: string | Date): string {
  return formatDate(date, {
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function relativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = Date.now();
  const diff = now - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}
