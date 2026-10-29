import { Router } from 'express';
import { history, redact } from '../controllers/redactionController.js';
import { ensureDatabase } from '../middleware/database.js';
import { requireAuth } from '../middleware/auth.js';
const router = Router();
router.get('/history', requireAuth, history);
router.post('/', requireAuth, ensureDatabase, ...redact);
export default router;
