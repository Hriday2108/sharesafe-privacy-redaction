import multer from 'multer';
import { z } from 'zod';
import Redaction from '../models/Redaction.js';
import User from '../models/User.js';
import { redactImage } from '../services/redactionService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } }).single('image');
const bodySchema = z.object({ regions: z.string().max(20_000) });
export const redact = [upload, asyncHandler(async (req, res) => {
  if (!req.file?.buffer) throw new Error('INVALID_IMAGE');
  const body = bodySchema.safeParse(req.body);
  if (!body.success) throw new Error('INVALID_REGIONS');
  let regions;
  try { regions = JSON.parse(body.data.regions); } catch { throw new Error('INVALID_REGIONS'); }
  const result = await redactImage(req.file.buffer, regions);
  const counts = { email: 0, phone: 0, identifier: 0, manual: 0 };
  for (const region of regions) counts[region.category] += 1;
  const userExists = await User.exists({ _id: req.user.id });
  if (!userExists) throw new Error('UNAUTHORIZED_USER');
  await Redaction.create({ userId: req.user.id, fileType: result.fileType, counts });
  res.set({ 'Content-Type': 'image/png', 'Content-Disposition': 'attachment; filename="sharesafe-redacted.png"', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Redaction-Verified': 'true' });
  return res.send(result.buffer);
})];
export const history = asyncHandler(async (req, res) => {
  const records = await Redaction.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(100).select('fileType counts createdAt').lean();
  return res.json({ history: records });
});
