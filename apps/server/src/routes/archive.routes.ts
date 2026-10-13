import { Router } from 'express';
import {
  listArchives,
  getArchive,
  listArchiveFrames,
  locateFrame,
  downloadArchive,
} from '../controllers/archive.controller.js';

const router = Router();

router.get('/archives', listArchives);
router.get('/archives/:id', getArchive);
router.get('/archives/:id/frames', listArchiveFrames);
router.get('/archives/:id/locate', locateFrame);
router.get('/archives/:id/download', downloadArchive);

export default router;
