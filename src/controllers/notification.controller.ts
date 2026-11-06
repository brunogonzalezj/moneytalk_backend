import { Request, Response } from 'express';
import { matchedData } from 'express-validator';
import { NotificationService, NotificationSettings, PushSubscriptionInput } from '../services/notification.service';

const SETTING_KEYS: (keyof NotificationSettings)[] = [
  'dailyReminder',
  'dailyTime',
  'weeklyReminder',
  'weeklyDay',
  'transactionReminder',
  'monthlyReport',
  'timezone',
];

// Only the known, validated fields are stored
const pickSettings = (source: unknown): Partial<NotificationSettings> => {
  if (!source || typeof source !== 'object') return {};
  const record = source as Record<string, unknown>;
  return Object.fromEntries(SETTING_KEYS.filter((key) => record[key] !== undefined).map((key) => [key, record[key]]));
};

export class NotificationController {
  static async subscribe(req: Request, res: Response) {
    const { subscription, settings } = req.body as { subscription: PushSubscriptionInput; settings?: unknown };
    await NotificationService.subscribe(req.user!.id, subscription, pickSettings(settings));
    res.status(204).send();
  }

  static async unsubscribe(req: Request, res: Response) {
    await NotificationService.unsubscribe(req.user!.id);
    res.status(204).send();
  }

  static async getStatus(req: Request, res: Response) {
    res.json(await NotificationService.getStatus(req.user!.id));
  }

  static async getSettings(req: Request, res: Response) {
    res.json({ settings: await NotificationService.getSettings(req.user!.id) });
  }

  static async saveSettings(req: Request, res: Response) {
    const data = matchedData(req, { locations: ['body'] }) as Record<string, unknown>;
    const changes = { ...pickSettings(data), ...pickSettings(data.settings) };
    res.json({ settings: await NotificationService.saveSettings(req.user!.id, changes) });
  }

  static async sendTest(req: Request, res: Response) {
    await NotificationService.sendTest(req.user!.id);
    res.status(204).send();
  }
}
