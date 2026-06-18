/**
 * DateRange — immutable value object representing a half-open date range
 * [start, end). Used heavily by reports, attendance queries, and payment
 * period filters.
 */

export class DateRange {
  readonly start: Date;
  readonly end: Date;

  constructor(start: Date | string, end: Date | string) {
    const s = typeof start === 'string' ? new Date(start) : start;
    const e = typeof end === 'string' ? new Date(end) : end;

    if (!s || Number.isNaN(s.getTime())) {
      throw new Error(`Invalid start date: ${start}`);
    }
    if (!e || Number.isNaN(e.getTime())) {
      throw new Error(`Invalid end date: ${end}`);
    }
    if (e < s) {
      throw new Error('DateRange end cannot be before start');
    }

    this.start = s;
    this.end = e;
  }

  contains(date: Date | string): boolean {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d >= this.start && d < this.end;
  }

  overlaps(other: DateRange): boolean {
    return this.start < other.end && other.start < this.end;
  }

  durationInDays(): number {
    return Math.ceil((this.end.getTime() - this.start.getTime()) / (1000 * 60 * 60 * 24));
  }

  /** Returns a new range expanded to fully cover both ranges. */
  union(other: DateRange): DateRange {
    return new DateRange(
      this.start < other.start ? this.start : other.start,
      this.end > other.end ? this.end : other.end
    );
  }

  static today(): DateRange {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return new DateRange(start, end);
  }

  static thisMonth(): DateRange {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return new DateRange(start, end);
  }

  static thisYear(): DateRange {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear() + 1, 0, 1);
    return new DateRange(start, end);
  }

  static lastNDays(days: number): DateRange {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    return new DateRange(start, end);
  }
}