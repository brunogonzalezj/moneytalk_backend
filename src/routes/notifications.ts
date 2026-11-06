import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { Prisma, PrismaClient } from '@prisma/client';
import webpush from 'web-push';
import jwt from 'jsonwebtoken';

const router = Router();
const prisma = new PrismaClient();

// Configurar VAPID solo si las variables de entorno están disponibles
const configureVapid = () => {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      'mailto:soporte@moneytalk.app',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  } else {
    console.warn('⚠️ VAPID keys no configuradas. Las notificaciones push no funcionarán correctamente.');
  }
};

configureVapid();

// Almacenar suscripciones (en producción, usar base de datos)
const subscriptions = new Map<string, any>();

// POST /api/notifications/subscribe
router.post('/subscribe', authMiddleware, async (req, res) => {
  try {
    const { subscription, settings } = req.body;
    const userId = (req as any).user.id;

    // Guardar suscripción en la base de datos
    await prisma.user.update({
      where: { id: userId },
      data: {
        notificationSubscription: subscription,
        notificationSettings: settings || {
          dailyReminder: false,
          dailyTime: '20:00',
          weeklyReminder: false,
          weeklyDay: 1,
          transactionReminder: true,
          monthlyReport: true,
        }
      }
    });

    subscriptions.set(userId, subscription);

    res.json({
      success: true,
      message: 'Suscripción guardada correctamente'
    });
  } catch (error) {
    console.error('Error al guardar suscripción:', error);
    res.status(500).json({
      success: false,
      message: 'Error al guardar suscripción'
    });
  }
});

// POST /api/notifications/unsubscribe
router.post('/unsubscribe', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    // Eliminar suscripción de la base de datos
    await prisma.user.update({
      where: { id: userId },
      data: {
        notificationSubscription: Prisma.DbNull,
        notificationSettings: Prisma.DbNull
      }
    });

    subscriptions.delete(userId);

    res.json({
      success: true,
      message: 'Suscripción eliminada correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar suscripción:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar suscripción'
    });
  }
});

// POST /api/notifications/settings
router.post('/settings', authMiddleware, async (req, res) => {
  try {
    const { settings } = req.body;
    const userId = (req as any).user.id;

    await prisma.user.update({
      where: { id: userId },
      data: {
        notificationSettings: settings
      }
    });

    res.json({
      success: true,
      message: 'Configuración guardada correctamente'
    });
  } catch (error) {
    console.error('Error al guardar configuración:', error);
    res.status(500).json({
      success: false,
      message: 'Error al guardar configuración'
    });
  }
});

// GET /api/notifications/status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        notificationSubscription: true,
        notificationSettings: true
      }
    });

    const hasSubscription = !!user?.notificationSubscription;
    const hasSettings = !!user?.notificationSettings;

    res.json({
      success: true,
      hasSubscription,
      hasSettings,
      settings: user?.notificationSettings || null
    });
  } catch (error) {
    console.error('Error al obtener estado de suscripción:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estado de suscripción',
      hasSubscription: false,
      hasSettings: false
    });
  }
});

// GET /api/notifications/settings
router.get('/settings', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationSettings: true }
    });

    res.json({
      success: true,
      settings: user?.notificationSettings || {
        dailyReminder: false,
        dailyTime: '20:00',
        weeklyReminder: false,
        weeklyDay: 1,
        transactionReminder: true,
        monthlyReport: true,
      }
    });
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener configuración'
    });
  }
});

// POST /api/notifications/test (para pruebas)
router.post('/test', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const subscription = subscriptions.get(userId);

    if (!subscription) {
      return res.status(400).json({
        success: false,
        message: 'No hay suscripción activa'
      });
    }

    const payload = JSON.stringify({
      title: 'MoneyTalk - Notificación de Prueba',
      body: '¡Las notificaciones están funcionando correctamente!',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'test',
      requireInteraction: false,
      actions: [
        {
          action: 'open',
          title: 'Abrir App'
        }
      ]
    });

    await webpush.sendNotification(subscription, payload);

    res.json({
      success: true,
      message: 'Notificación de prueba enviada'
    });
  } catch (error) {
    console.error('Error al enviar notificación de prueba:', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar notificación'
    });
  }
});

// Función para enviar notificaciones a un usuario específico
export const sendNotificationToUser = async (
  userId: number,
  title: string,
  body: string,
  options?: any
) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationSubscription: true }
    });

    if (!user?.notificationSubscription) {
      return false;
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: options?.tag || 'general',
      requireInteraction: options?.requireInteraction || false,
      actions: options?.actions || [],
      data: options?.data || {}
    });

    await webpush.sendNotification(user.notificationSubscription as any, payload);
    return true;
  } catch (error) {
    console.error(`Error al enviar notificación a usuario ${userId}:`, error);

    // Si la suscripción es inválida, eliminarla
    if ((error as { statusCode?: number }).statusCode === 410) {
      await prisma.user.update({
        where: { id: userId },
        data: { notificationSubscription: Prisma.DbNull }
      });
    }

    return false;
  }
};

// Función para enviar recordatorio diario
export const sendDailyReminder = async () => {
  const users = await prisma.user.findMany({
    where: {
      notificationSettings: {
        not: undefined
      }
    },
    select: {
      id: true,
      notificationSettings: true,
      name: true,
      email: true
    }
  });

  // Filtrar en memoria los usuarios que tienen dailyReminder: true
  const filteredUsers = users.filter(user => {
    const settings = user.notificationSettings as any;
    return settings && settings.dailyReminder === true;
  });

  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  for (const user of filteredUsers) {
    const settings = user.notificationSettings as any;
    if (settings.dailyTime === currentTime) {
      await sendNotificationToUser(
        user.id,
        'MoneyTalk - Recordatorio Diario',
        `¡Hola ${user.name || 'usuario'}! No olvides registrar tus transacciones de hoy.`,
        {
          tag: 'daily-reminder',
          actions: [
            {
              action: 'add-transaction',
              title: 'Agregar Transacción'
            }
          ]
        }
      );
    }
  }
};

// Función para enviar recordatorio semanal
export const sendWeeklyReminder = async () => {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

  const users = await prisma.user.findMany({
    where: {
      notificationSettings: {
        not: undefined
      }
    },
    select: {
      id: true,
      notificationSettings: true,
      name: true,
      email: true
    }
  });

  // Filtrar en memoria los usuarios que tienen weeklyReminder: true y weeklyDay === currentDay
  const filteredUsers = users.filter(user => {
    const settings = user.notificationSettings as any;
    return settings &&
           settings.weeklyReminder === true &&
           settings.weeklyDay === currentDay;
  });

  for (const user of filteredUsers) {
    await sendNotificationToUser(
      user.id,
      'MoneyTalk - Revisión Semanal',
      `${user.name || 'Usuario'}, es momento de revisar tus finanzas de esta semana.`,
      {
        tag: 'weekly-reminder',
        requireInteraction: true,
        actions: [
          {
            action: 'view-reports',
            title: 'Ver Reportes'
          },
          {
            action: 'add-transaction',
            title: 'Agregar Transacción'
          }
        ]
      }
    );
  }
};

// Función para enviar reporte mensual
export const sendMonthlyReport = async () => {
  const now = new Date();
  const isFirstDay = now.getDate() === 1;

  if (!isFirstDay) return;

  const users = await prisma.user.findMany({
    where: {
      notificationSettings: {
        not: undefined
      }
    },
    select: {
      id: true,
      notificationSettings: true,
      name: true,
      email: true
    }
  });

  // Filtrar en memoria los usuarios que tienen monthlyReport: true
  const filteredUsers = users.filter(user => {
    const settings = user.notificationSettings as any;
    return settings && settings.monthlyReport === true;
  });

  for (const user of filteredUsers) {
    await sendNotificationToUser(
      user.id,
      'MoneyTalk - Reporte Mensual',
      `¡Nuevo mes comienza! Revisa tu resumen financiero del mes anterior.`,
      {
        tag: 'monthly-report',
        requireInteraction: true,
        actions: [
          {
            action: 'view-reports',
            title: 'Ver Reporte'
          }
        ]
      }
    );
  }
};

export default router;