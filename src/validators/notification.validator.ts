import { body } from 'express-validator';

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

const isValidTimezone = (value: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

// Accepts the settings either flat in the body or nested under `settings`
const settingsFields = (prefix: string) => [
  body(`${prefix}dailyReminder`).optional().isBoolean().withMessage('dailyReminder debe ser verdadero o falso'),
  body(`${prefix}dailyTime`)
    .optional()
    .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    .withMessage('dailyTime debe tener el formato HH:MM'),
  body(`${prefix}weeklyReminder`).optional().isBoolean().withMessage('weeklyReminder debe ser verdadero o falso'),
  body(`${prefix}weeklyDay`).optional().isInt({ min: 0, max: 6 }).withMessage('weeklyDay debe estar entre 0 y 6'),
  body(`${prefix}transactionReminder`).optional().isBoolean(),
  body(`${prefix}monthlyReport`).optional().isBoolean(),
  body(`${prefix}timezone`).optional().isString().custom(isValidTimezone).withMessage('Zona horaria inválida'),
];

export const subscribeValidator = [
  body('subscription.endpoint').isURL({ protocols: ['https'], require_tld: false }).withMessage('endpoint inválido'),
  body('subscription.keys.p256dh')
    .isString()
    .matches(BASE64URL)
    .withMessage('keys.p256dh debe ser una cadena base64url (usa subscription.toJSON())'),
  body('subscription.keys.auth')
    .isString()
    .matches(BASE64URL)
    .withMessage('keys.auth debe ser una cadena base64url (usa subscription.toJSON())'),
  ...settingsFields('settings.'),
];

export const settingsValidator = [...settingsFields(''), ...settingsFields('settings.')];
