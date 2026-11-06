import { Prisma } from '@prisma/client';
import { env } from '../config/env';
import prisma from '../lib/prisma';
import { getWebPush } from '../lib/webPush';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

export interface NotificationSettings {
  dailyReminder: boolean;
  dailyTime: string; // HH:MM, user's local time
  weeklyReminder: boolean;
  weeklyDay: number; // 0 = domingo ... 6 = sábado
  transactionReminder: boolean;
  monthlyReport: boolean;
  timezone: string; // IANA, e.g. America/La_Paz
  // Last local date (YYYY-MM-DD) each reminder went out, so it fires once per day
  lastDailySent?: string;
  lastWeeklySent?: string;
  lastMonthlySent?: string;
}

export interface PushSubscriptionInput {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
}

interface PushMessage {
  title: string;
  body: string;
  tag: string;
  url?: string;
  requireInteraction?: boolean;
  actions?: { action: string; title: string }[];
}

type Subscriber = {
  id: number;
  name: string;
  notificationSubscription: Prisma.JsonValue;
  notificationSettings: Prisma.JsonValue;
};

export const DEFAULT_SETTINGS: NotificationSettings = {
  dailyReminder: false,
  dailyTime: '20:00',
  weeklyReminder: false,
  weeklyDay: 1,
  transactionReminder: true,
  monthlyReport: true,
  timezone: env.APP_TIMEZONE,
};

// Daily reminders go out in the first run after the configured time, within this window
const DAILY_WINDOW_MINUTES = 60;
// Weekly and monthly reminders wait for a reasonable local hour
const DIGEST_FROM_MINUTES = 9 * 60;
const SEND_BATCH_SIZE = 10;

const readSettings = (value: Prisma.JsonValue | null | undefined): NotificationSettings => {
  const stored = value && typeof value === 'object' && !Array.isArray(value) ? (value as Partial<NotificationSettings>) : {};
  return { ...DEFAULT_SETTINGS, ...stored };
};

// Public view of the settings: the bookkeeping fields stay server-side
const publicSettings = ({ lastDailySent, lastWeeklySent, lastMonthlySent, ...settings }: NotificationSettings) => settings;

/** Local calendar date, time and weekday for `date` in `timeZone`. */
const localParts = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
    weekday: weekdays.indexOf(get('weekday')),
    dayOfMonth: Number(get('day')),
  };
};

const safeLocalParts = (date: Date, timeZone: string) => {
  try {
    return localParts(date, timeZone);
  } catch {
    return localParts(date, env.APP_TIMEZONE);
  }
};

const toMinutes = (hhmm: string) => {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
};

export class NotificationService {
  static async subscribe(userId: number, subscription: PushSubscriptionInput, settings?: Partial<NotificationSettings>) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { notificationSettings: true } });
    if (!user) throw AppError.notFound('Usuario no encontrado');

    const merged = { ...readSettings(user.notificationSettings), ...(settings ?? {}) };
    await prisma.user.update({
      where: { id: userId },
      data: {
        notificationSubscription: subscription as unknown as Prisma.InputJsonValue,
        notificationSettings: merged as unknown as Prisma.InputJsonValue,
      },
    });
  }

  // Settings are kept so re-subscribing restores the user's preferences
  static async unsubscribe(userId: number) {
    await prisma.user.update({
      where: { id: userId },
      data: { notificationSubscription: Prisma.DbNull },
    });
  }

  static async getSettings(userId: number) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { notificationSettings: true } });
    if (!user) throw AppError.notFound('Usuario no encontrado');
    return publicSettings(readSettings(user.notificationSettings));
  }

  static async saveSettings(userId: number, changes: Partial<NotificationSettings>) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { notificationSettings: true } });
    if (!user) throw AppError.notFound('Usuario no encontrado');

    const merged = { ...readSettings(user.notificationSettings), ...changes };
    await prisma.user.update({
      where: { id: userId },
      data: { notificationSettings: merged as unknown as Prisma.InputJsonValue },
    });
    return publicSettings(merged);
  }

  static async getStatus(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationSubscription: true, notificationSettings: true },
    });
    if (!user) throw AppError.notFound('Usuario no encontrado');
    return {
      hasSubscription: Boolean(user.notificationSubscription),
      settings: publicSettings(readSettings(user.notificationSettings)),
      pushEnabled: getWebPush() !== null,
    };
  }

  static async sendTest(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, notificationSubscription: true, notificationSettings: true },
    });
    if (!user?.notificationSubscription) {
      throw AppError.badRequest('No hay una suscripción activa en este dispositivo');
    }
    const delivered = await this.deliver(user, {
      title: 'MoneyTalk - Notificación de prueba',
      body: '¡Las notificaciones están funcionando correctamente!',
      tag: 'test',
    });
    if (!delivered) throw AppError.badGateway('No se pudo entregar la notificación', 'PUSH_FAILED');
  }

  /**
   * Sends one push. Subscriptions the push service reports as gone (404/410)
   * are removed so they are not retried.
   */
  private static async deliver(user: Pick<Subscriber, 'id' | 'notificationSubscription'>, message: PushMessage): Promise<boolean> {
    const webPush = getWebPush();
    if (!webPush || !user.notificationSubscription) return false;

    const payload = JSON.stringify({
      title: message.title,
      body: message.body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: message.tag,
      requireInteraction: message.requireInteraction ?? false,
      actions: message.actions ?? [],
      data: { url: message.url ?? '/dashboard' },
    });

    try {
      await webPush.sendNotification(user.notificationSubscription as unknown as PushSubscriptionInput, payload);
      return true;
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await prisma.user.update({ where: { id: user.id }, data: { notificationSubscription: Prisma.DbNull } });
        logger.info(`Suscripción push expirada eliminada (usuario ${user.id})`);
      } else {
        logger.warn(`No se pudo enviar push al usuario ${user.id}`, statusCode ?? (error as Error).message);
      }
      return false;
    }
  }

  private static async subscribers(): Promise<Subscriber[]> {
    return prisma.user.findMany({
      where: { notificationSubscription: { not: Prisma.DbNull } },
      select: { id: true, name: true, notificationSubscription: true, notificationSettings: true },
    });
  }

  /**
   * Shared loop for the scheduled reminders: picks the users `isDue` accepts,
   * sends in small parallel batches and records the local date it was sent.
   */
  private static async runReminder(
    now: Date,
    sentKey: 'lastDailySent' | 'lastWeeklySent' | 'lastMonthlySent',
    isDue: (settings: NotificationSettings, local: ReturnType<typeof localParts>) => boolean,
    message: (user: Subscriber) => PushMessage
  ) {
    if (!getWebPush()) return { sent: 0 };

    const due = (await this.subscribers())
      .map((user) => {
        const settings = readSettings(user.notificationSettings);
        return { user, settings, local: safeLocalParts(now, settings.timezone) };
      })
      .filter(({ settings, local }) => settings[sentKey] !== local.date && isDue(settings, local));

    let sent = 0;
    for (let i = 0; i < due.length; i += SEND_BATCH_SIZE) {
      const batch = due.slice(i, i + SEND_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async ({ user, settings, local }) => {
          const delivered = await this.deliver(user, message(user));
          if (delivered) {
            await prisma.user.update({
              where: { id: user.id },
              data: { notificationSettings: { ...settings, [sentKey]: local.date } as unknown as Prisma.InputJsonValue },
            });
          }
          return delivered;
        })
      );
      sent += results.filter((result) => result.status === 'fulfilled' && result.value).length;
    }
    return { sent };
  }

  static runDailyReminders(now = new Date()) {
    return this.runReminder(
      now,
      'lastDailySent',
      (settings, local) => {
        if (!settings.dailyReminder) return false;
        const elapsed = local.minutes - toMinutes(settings.dailyTime);
        return elapsed >= 0 && elapsed < DAILY_WINDOW_MINUTES;
      },
      (user) => ({
        title: 'MoneyTalk - Recordatorio diario',
        body: `¡Hola ${user.name || 'usuario'}! No olvides registrar tus transacciones de hoy.`,
        tag: 'daily-reminder',
        url: '/transactions/new',
        actions: [{ action: 'add-transaction', title: 'Agregar transacción' }],
      })
    );
  }

  static runWeeklyReminders(now = new Date()) {
    return this.runReminder(
      now,
      'lastWeeklySent',
      (settings, local) =>
        settings.weeklyReminder && settings.weeklyDay === local.weekday && local.minutes >= DIGEST_FROM_MINUTES,
      (user) => ({
        title: 'MoneyTalk - Revisión semanal',
        body: `${user.name || 'Hola'}, es momento de revisar tus finanzas de esta semana.`,
        tag: 'weekly-reminder',
        url: '/reports',
        requireInteraction: true,
        actions: [{ action: 'view-reports', title: 'Ver reportes' }],
      })
    );
  }

  static runMonthlyReports(now = new Date()) {
    return this.runReminder(
      now,
      'lastMonthlySent',
      (settings, local) => settings.monthlyReport && local.dayOfMonth === 1 && local.minutes >= DIGEST_FROM_MINUTES,
      () => ({
        title: 'MoneyTalk - Reporte mensual',
        body: '¡Comienza un nuevo mes! Revisa el resumen financiero del mes anterior.',
        tag: 'monthly-report',
        url: '/reports',
        requireInteraction: true,
        actions: [{ action: 'view-reports', title: 'Ver reporte' }],
      })
    );
  }
}
