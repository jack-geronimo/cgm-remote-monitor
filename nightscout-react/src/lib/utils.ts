import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get BG color class based on value
 */
export function getBgColor(bg: number): string {
  if (bg < 55) return 'text-bg-urgent';
  if (bg < 70) return 'text-bg-warning';
  if (bg <= 180) return 'text-bg-success';
  if (bg <= 250) return 'text-bg-warning';
  return 'text-bg-urgent';
}

/**
 * Get BG status class for pills/backgrounds
 */
export function getBgStatus(bg: number): 'urgent' | 'warning' | 'success' {
  if (bg < 70 || bg > 250) return 'urgent';
  if ((bg >= 70 && bg < 80) || (bg > 180 && bg <= 250)) return 'warning';
  return 'success';
}

/**
 * Get trend arrow based on direction
 */
export function getTrendArrow(direction: string): string {
  const arrows: Record<string, string> = {
    'DoubleUp': '⇈',
    'SingleUp': '↑',
    'FortyFiveUp': '↗',
    'Flat': '→',
    'FortyFiveDown': '↘',
    'SingleDown': '↓',
    'DoubleDown': '⇊',
    'NOT COMPUTABLE': '?',
    'RATE OUT OF RANGE': '⚠',
  };
  return arrows[direction] || '→';
}

/**
 * Format time ago
 */
export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago';

  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

/**
 * Format BG value for display
 */
export function formatBgValue(bg: number | null | undefined, units: 'mg/dl' | 'mmol'  = 'mg/dl'): string {
  if (bg === null || bg === undefined) return '---';

  if (units === 'mmol') {
    return (bg / 18).toFixed(1);
  }

  return Math.round(bg).toString();
}
