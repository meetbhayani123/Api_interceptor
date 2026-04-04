import { Router } from 'express';
import { startPolling, stopPolling, getPollingStatus } from '../controllers/polling.controller.js';

const router = Router();

router.post('/match/:id/start-polling', startPolling);
router.post('/match/:id/stop-polling', stopPolling);
router.get('/match/:id/polling-status', getPollingStatus);

export default router;
