import { RecurrenceFrequency } from '../generated/prisma/client';
import { env } from '../config/env';

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Next occurrence after `currentDate`, in UTC. Month and year steps clamp to the
 * last day of the target month (Jan 31 + 1 month = Feb 28/29, not Mar 3).
 */
export function calculateNextDate(currentDate: Date, frequency: RecurrenceFrequency): Date {
  const next = new Date(currentDate);

  if (frequency === 'DAILY') {
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }
  if (frequency === 'WEEKLY') {
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }

  const months = frequency === 'MONTHLY' ? 1 : 12;
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}

export const isIsoDate = (value: unknown): value is string =>
  typeof value === 'string' && ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** Calendar date (YYYY-MM-DD) of `date` as seen in `timeZone`. */
export const toLocalIsoDate = (date: Date, timeZone = env.APP_TIMEZONE): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

/** Spanish weekday name for a YYYY-MM-DD calendar date. */
export const weekdayName = (isoDate: string): string =>
  new Intl.DateTimeFormat('es-BO', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00Z`));

export const addDaysToIsoDate = (isoDate: string, days: number): string =>
  new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/**
 * Calendar dates are stored at 12:00 UTC so they read back as the same day in
 * any timezone between UTC-12 and UTC+11.
 */
export const isoDateToStoredDate = (isoDate: string): Date => new Date(`${isoDate}T12:00:00.000Z`);

/** UTC instant bounds that cover whole calendar days `from`..`to` (inclusive). */
export const isoDateRangeToBounds = (from?: string, to?: string) => ({
  ...(from && { gte: new Date(`${from}T00:00:00.000Z`) }),
  ...(to && { lte: new Date(`${to}T23:59:59.999Z`) }),
});
