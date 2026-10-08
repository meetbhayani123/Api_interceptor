import { Router } from 'express';
import {
  saveBook,
  listSavedBookMatches,
  listSavedBooksForMatch,
} from '../controllers/savedBook.controller.js';

const router = Router();

router.post('/match/:id/save-book', saveBook);
router.get('/saved-books', listSavedBookMatches);
router.get('/saved-books/:matchId', listSavedBooksForMatch);

export default router;
