import { RecurrenceFrequency } from '@prisma/client';

export function calculateNextDate(currentDate: Date, frequency: RecurrenceFrequency): Date {
  const nextDate = new Date(currentDate);
  
  switch (frequency) {
    case 'DAILY':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'WEEKLY':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'MONTHLY':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'YEARLY':
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
  }
  
  return nextDate;
}

export function isDateInRange(date: Date, startDate: Date, endDate: Date): boolean {
  return date >= startDate && date <= endDate;
}

export function checkDateOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 <= end2 && start2 <= end1;
}
