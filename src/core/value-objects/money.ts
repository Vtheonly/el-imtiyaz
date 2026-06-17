/**
 * Money — strict value object for monetary amounts.
 *
 * Why a class instead of `number`?
 *  - Prevents accidental mixing of DZD with other currencies.
 *  - All arithmetic rounds to 2 decimal places to avoid float drift.
 *  - `format()` outputs the human-readable DZD representation (with Arabic
 *    locale) so presentation logic is consistent across the app.
 *
 * All amounts in this system are in **Algerian Dinar (DZD)**. The currency
 * code is enforced at the value-object boundary.
 */

export const CURRENCY_CODE = 'DZD' as const;
export const CURRENCY_SYMBOL = 'د.ج' as const;
export const CURRENCY_LOCALE = 'ar-DZ' as const;

export class Money {
  /** Raw amount in major units (DZD, not centimes). Stored to 2 decimal places. */
  readonly amount: number;
  readonly currency: typeof CURRENCY_CODE = CURRENCY_CODE;

  constructor(amount: number, currency: string = CURRENCY_CODE) {
    if (currency !== CURRENCY_CODE) {
      throw new Error(`Unsupported currency: ${currency}. Only DZD is allowed.`);
    }
    if (Number.isNaN(amount) || !Number.isFinite(amount)) {
      throw new Error(`Invalid money amount: ${amount}`);
    }
    this.amount = Math.round(amount * 100) / 100;
  }

  static zero(): Money {
    return new Money(0);
  }

  static from(amount: number): Money {
    return new Money(amount);
  }

  static max(...values: Money[]): Money {
    return values.reduce((max, v) => (v.amount > max.amount ? v : max), Money.zero());
  }

  static sum(...values: Money[]): Money {
    return values.reduce((acc, v) => acc.add(v), Money.zero());
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.amount);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount - other.amount);
  }

  multiply(factor: number): Money {
    return new Money(this.amount * factor);
  }

  divide(factor: number): Money {
    if (factor === 0) throw new Error('Division by zero');
    return new Money(this.amount / factor);
  }

  isZero(): boolean {
    return this.amount === 0;
  }

  isPositive(): boolean {
    return this.amount > 0;
  }

  isNegative(): boolean {
    return this.amount < 0;
  }

  isGreaterThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount >= other.amount;
  }

  isLessThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount <= other.amount;
  }

  private assertSameCurrency(other: Money): void {
    if (other.currency !== this.currency) {
      throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }

  /** Human-readable: `12,500.00 د.ج` */
  format(): string {
    const formatted = new Intl.NumberFormat(CURRENCY_LOCALE, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(this.amount);
    return `${formatted} ${CURRENCY_SYMBOL}`;
  }

  /** Numeric-only formatted: `12,500.00` */
  formatAmount(): string {
    return new Intl.NumberFormat(CURRENCY_LOCALE, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(this.amount);
  }

  toJSON(): number {
    return this.amount;
  }

  static fromJSON(value: number): Money {
    return new Money(value);
  }
}
