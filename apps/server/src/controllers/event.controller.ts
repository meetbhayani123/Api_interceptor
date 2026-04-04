import type { Request, Response } from 'express';
import { OddsService } from '../services/OddsService.js';

const oddsService = new OddsService();

/** GET /api/event/:eventId — Fetch event details from external API */
export async function getEventDetails(req: Request, res: Response) {
  try {
    const details = await oddsService.getEventDetails(req.params.eventId);
    res.json(details);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to fetch event details' });
  }
}

/** GET /api/market/:marketId — Fetch market odds from external API */
export async function getMarketOdds(req: Request, res: Response) {
  try {
    const odds = await oddsService.getMarketOdds(req.params.marketId);
    res.json(odds);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to fetch market odds' });
  }
}
