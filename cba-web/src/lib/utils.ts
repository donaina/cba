import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Decimal from 'decimal.js';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format monetary value in Naira.
 * Always uses Decimal.js — never native float arithmetic.
 */
export function formatNaira(value: string | number | Decimal | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const decimal = new Decimal(value);
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(decimal.toNumber());
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function maskBvn(bvn: string): string {
  return `••••••${bvn.slice(-4)}`;
}

export function maskAccount(nuban: string): string {
  return `••••••${nuban.slice(-4)}`;
}

export function loanClassificationVariant(
  classification: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (classification) {
    case 'PERFORMING': return 'default';
    case 'WATCH': return 'secondary';
    case 'SUBSTANDARD':
    case 'DOUBTFUL': return 'outline';
    case 'LOST': return 'destructive';
    default: return 'secondary';
  }
}
