import { Router } from 'express';
import { getEventDetails, getMarketOdds } from '../controllers/event.controller.js';

const router = Router();

router.get('/event/:eventId', getEventDetails);
router.get('/market/:marketId', getMarketOdds);

export default router;
