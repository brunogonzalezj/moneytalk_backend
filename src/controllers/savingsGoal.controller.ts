import { Request, Response } from 'express';
import { matchedData } from 'express-validator';
import { SavingsGoalService } from '../services/savingsGoal.service';

const goalId = (req: Request) => matchedData(req, { locations: ['params'] }).id as number;

export class SavingsGoalController {
  static async list(req: Request, res: Response) {
    const { type, status } = matchedData(req, { locations: ['query'] });
    res.json({ savingsGoals: await SavingsGoalService.list(req.user!.id, { type, status }) });
  }

  static async get(req: Request, res: Response) {
    res.json(await SavingsGoalService.get(req.user!.id, goalId(req)));
  }

  static async create(req: Request, res: Response) {
    const data = matchedData(req, { locations: ['body'] });
    res.status(201).json(await SavingsGoalService.create(req.user!.id, data as never));
  }

  static async update(req: Request, res: Response) {
    const data = matchedData(req, { locations: ['body'] });
    res.json(await SavingsGoalService.update(req.user!.id, goalId(req), data));
  }

  static async remove(req: Request, res: Response) {
    await SavingsGoalService.remove(req.user!.id, goalId(req));
    res.status(204).send();
  }

  static async contribute(req: Request, res: Response) {
    res.json(await SavingsGoalService.contribute(req.user!.id, goalId(req), req.body.amount));
  }
}
