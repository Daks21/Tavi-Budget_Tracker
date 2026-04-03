/**
 * Currency and amount utilities for Tavi.
 * Locale: en-PH | Default currency: PHP
 *
 * Exports (per Step 2.1.7 spec):
 *   formatCurrency(amount, currency?)     → "₱1,234.56" | "-₱1,234.56"
 *   formatCurrencyCompact(amount)         → "₱1.2K" | "₱1.2M"
 *   formatBalanceDisplay(amount, isPrivate) → "₱1,234.56" | "₱ ••••"
 *   parseAmountInput(input)               → 1234.56 | 0
 */

const LOCALE = 'en-PH';

// ─── Internal guard ───────────────────────────────────────────────────────────

function safeNumber(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return value;
}

// ─── formatCurrency ───────────────────────────────────────────────────────────

/**
 * Full precision peso display. Sign comes before the symbol.
 *
 * @example
 * formatCurrency(1234.56)          // "₱1,234.56"
 * formatCurrency(-1234.56)         // "-₱1,234.56"
 * formatCurrency(0)                // "₱0.00"
 * formatCurrency(null)             // "₱0.00"
 * formatCurrency(1234.56, 'USD')   // "USD1,234.56"
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency: string = 'PHP',
): string {
  const safe = safeNumber(amount);
  const abs = Math.abs(safe);
  const sign = safe < 0 ? '-' : '';
  const symbol = currency === 'PHP' ? '₱' : currency;

  const formatted = abs.toLocaleString(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${sign}${symbol}${formatted}`;
}

// ─── formatCurrencyCompact ────────────────────────────────────────────────────

/**
 * Abbreviated display for space-constrained widgets.
 *
 * @example
 * formatCurrencyCompact(999)       // "₱999.00"
 * formatCurrencyCompact(1200)      // "₱1.2K"
 * formatCurrencyCompact(45600)     // "₱45.6K"
 * formatCurrencyCompact(999900)    // "₱999.9K"
 * formatCurrencyCompact(1200000)   // "₱1.2M"
 * formatCurrencyCompact(-5000)     // "-₱5.0K"
 */
export function formatCurrencyCompact(amount: number | null | undefined): string {
  const safe = safeNumber(amount);
  const abs = Math.abs(safe);
  const sign = safe < 0 ? '-' : '';

  if (abs >= 1_000_000) {
    const n = (abs / 1_000_000).toLocaleString(LOCALE, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return `${sign}₱${n}M`;
  }

  if (abs >= 1_000) {
    const n = (abs / 1_000).toLocaleString(LOCALE, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return `${sign}₱${n}K`;
  }

  const n = abs.toLocaleString(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}₱${n}`;
}

// ─── formatBalanceDisplay ─────────────────────────────────────────────────────

/**
 * Privacy-aware balance display. Used on any screen that respects privacy mode.
 *
 * @example
 * formatBalanceDisplay(1234.56, false)  // "₱1,234.56"
 * formatBalanceDisplay(1234.56, true)   // "₱ ••••"
 */
export function formatBalanceDisplay(
  amount: number | null | undefined,
  isPrivate: boolean,
): string {
  if (isPrivate) return '₱ ••••';
  return formatCurrency(amount);
}

// ─── parseAmountInput ─────────────────────────────────────────────────────────

/**
 * Parses a raw user-typed string into a number.
 * Strips ₱, commas, and whitespace. Returns 0 on failure — never throws.
 *
 * @example
 * parseAmountInput('₱1,234.56')   // 1234.56
 * parseAmountInput('12,345')      // 12345
 * parseAmountInput('')            // 0
 * parseAmountInput('abc')         // 0
 */
export function parseAmountInput(input: string | null | undefined): number {
  if (!input) return 0;

  const cleaned = input
    .replace(/₱/g, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .trim();

  if (!cleaned) return 0;

  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) || !Number.isFinite(parsed) ? 0 : parsed;
}