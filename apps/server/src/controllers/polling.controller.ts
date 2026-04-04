import type { Request, Response } from 'express';
import * as PollingService from '../services/PollingService.js';

/** POST /api/match/:id/start-polling */
export async function startPolling(req: Request, res: Response) {
  const matchId = req.params.id;
  const started = await PollingService.startPolling(matchId);

  if (!started) {
    return res.json({ message: 'Polling already active' });
  }

  res.json({ message: 'Polling started' });
}

/** POST /api/match/:id/stop-polling */
export async function stopPolling(req: Request, res: Response) {
  await PollingService.stopPolling(req.params.id);
  res.json({ message: 'Polling stopped' });
}

/** GET /api/match/:id/polling-status */
export function getPollingStatus(req: Request, res: Response) {
  res.json({ isPolling: PollingService.isPolling(req.params.id) });
}
