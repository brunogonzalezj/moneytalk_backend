import webpush from 'web-push';
import { env } from '../config/env';
import { logger } from '../utils/logger';

let configured: boolean | undefined;

/**
 * Configures VAPID on first use. Returns the client, or null when push is
 * disabled because the keys are missing.
 */
export const getWebPush = (): typeof webpush | null => {
  if (configured === undefined) {
    configured = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
    if (configured) {
      webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
    } else {
      logger.warn('VAPID no configurado: las notificaciones push están desactivadas');
    }
  }
  return configured ? webpush : null;
};
