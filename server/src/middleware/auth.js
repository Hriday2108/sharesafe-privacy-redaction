import jwt from 'jsonwebtoken';
export function requireAuth(req, res, next) {
  const token = req.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });
  try { const payload = jwt.verify(token, process.env.JWT_SECRET); req.user = { id: payload.sub }; return next(); }
  catch { return res.status(401).json({ error: 'Your session is invalid or expired. Please sign in again.' }); }
}
