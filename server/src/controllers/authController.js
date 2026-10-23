import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
const registration = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().email().max(254), password: z.string().min(8).max(72) });
const loginInput = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(72) });
function tokenFor(user) { return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' }); }
export const register = asyncHandler(async (req, res) => {
  const parsed = registration.safeParse(req.body);
  if (!parsed.success) throw new Error('VALIDATION');
  const { name, email, password } = parsed.data;
  const existing = await User.exists({ email: email.toLowerCase() });
  if (existing) throw new Error('EMAIL_TAKEN');
  const user = await User.create({ name, email: email.toLowerCase(), passwordHash: await bcrypt.hash(password, 12) });
  return res.status(201).json({ token: tokenFor(user), user: { id: user.id, name: user.name, email: user.email } });
});
export const login = asyncHandler(async (req, res) => {
  const parsed = loginInput.safeParse(req.body);
  if (!parsed.success) throw new Error('INVALID_CREDENTIALS');
  const user = await User.findOne({ email: parsed.data.email.toLowerCase() }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) throw new Error('INVALID_CREDENTIALS');
  return res.json({ token: tokenFor(user), user: { id: user.id, name: user.name, email: user.email } });
});
