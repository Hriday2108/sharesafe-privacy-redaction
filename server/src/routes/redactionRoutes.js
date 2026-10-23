import { Router } from 'express';
import { history, redact } from '../controllers/redactionController.js';
import { requireAuth } from '../middleware/auth.js';
const router = Router();
router.get('/history', requireAuth, history);
router.post('/', requireAuth, ...redact);
export default router;
