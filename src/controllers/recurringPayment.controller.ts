import { Request, Response } from 'express';
import { matchedData } from 'express-validator';
import { runRecurringPayments } from '../jobs/recurringPayments.job';
import { RecurringPaymentService } from '../services/recurringPayment.service';

const paymentId = (req: Request) => matchedData(req, { locations: ['params'] }).id as number;

export class RecurringPaymentController {
  static async list(req: Request, res: Response) {
    const { isActive, frequency } = matchedData(req, { locations: ['query'] });
    res.json({ recurringPayments: await RecurringPaymentService.list(req.user!.id, { isActive, frequency }) });
  }

  static async get(req: Request, res: Response) {
    res.json(await RecurringPaymentService.get(req.user!.id, paymentId(req)));
  }

  static async create(req: Request, res: Response) {
    const data = matchedData(req, { locations: ['body'] });
    res.status(201).json(await RecurringPaymentService.create(req.user!.id, data as never));
  }

  static async update(req: Request, res: Response) {
    const data = matchedData(req, { locations: ['body'] });
    res.json(await RecurringPaymentService.update(req.user!.id, paymentId(req), data));
  }

  static async remove(req: Request, res: Response) {
    await RecurringPaymentService.remove(req.user!.id, paymentId(req));
    res.status(204).send();
  }

  static async execute(req: Request, res: Response) {
    res.status(201).json(await RecurringPaymentService.executeNow(req.user!.id, paymentId(req)));
  }

  // Admin only: runs the same processing the daily job does
  static async processAll(_req: Request, res: Response) {
    res.json((await runRecurringPayments()) ?? { processed: 0, successful: 0, failed: 0, results: [], skipped: true });
  }
}
