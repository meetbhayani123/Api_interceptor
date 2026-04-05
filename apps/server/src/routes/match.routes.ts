import { Router } from 'express';
import {
  importMatches,
  importMatchDetails,
  listMatches,
  getMatch,
  deleteMatch,
  lockBook,
} from '../controllers/match.controller.js';

const router = Router();

router.post('/match/import', importMatches);
router.post('/match/import-details', importMatchDetails);
router.get('/matches', listMatches);
router.get('/match/:id', getMatch);
router.delete('/match/:id', deleteMatch);
router.post('/match/:id/lock', lockBook);

export default router;
