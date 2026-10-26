import { Router } from 'express';
import {
  listArchives,
  getArchive,
  listArchiveFrames,
  locateFrame,
  downloadArchive,
  deleteArchive,
} from '../controllers/archive.controller.js';

const router = Router();

router.get('/archives', listArchives);
router.get('/archives/:id', getArchive);
router.get('/archives/:id/frames', listArchiveFrames);
router.get('/archives/:id/locate', locateFrame);
router.get('/archives/:id/download', downloadArchive);
router.delete('/archives/:id', deleteArchive);

export default router;
