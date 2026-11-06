import { Request, Response } from 'express';
import { CategorizationService } from '../services/ai/categorization.service';
import { RecommendationsService } from '../services/ai/recommendations.service';

export class AiController {
  static async categorize(req: Request, res: Response) {
    res.json(await CategorizationService.categorize(req.user!.id, req.body.text));
  }

  static async recommendations(req: Request, res: Response) {
    res.json(await RecommendationsService.getRecommendations(req.user!.id, req.body?.forceRefresh === true));
  }
}
