export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err?.name === 'MulterError') return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 10 MB or smaller.' : 'The uploaded image could not be accepted.' });
  if (err?.name === 'ZodError') return res.status(400).json({ error: 'Please check the submitted information.' });
  if (err?.message === 'INVALID_IMAGE') return res.status(400).json({ error: 'Upload a valid PNG or JPEG image.' });
  if (err?.message === 'IMAGE_TOO_LARGE') return res.status(400).json({ error: 'Image dimensions must be no larger than 6000 × 6000 pixels.' });
  if (err?.message === 'INVALID_REGIONS') return res.status(400).json({ error: 'One or more redaction regions are invalid.' });
  if (err?.message === 'NO_REGIONS') return res.status(400).json({ error: 'Select at least one region to redact.' });
  if (err?.message === 'INVALID_CREDENTIALS') return res.status(401).json({ error: 'Email or password is incorrect.' });
  if (err?.message === 'EMAIL_TAKEN') return res.status(409).json({ error: 'An account with this email already exists.' });
  if (err?.message === 'VALIDATION') return res.status(400).json({ error: 'Please check your name, email, and password.' });
  if (err?.message === 'UNAUTHORIZED_USER') return res.status(401).json({ error: 'Your account is no longer available. Please register again.' });
  if (err?.message === 'CORS_ORIGIN') return res.status(403).json({ error: 'This origin is not allowed.' });
  if (process.env.NODE_ENV !== 'production') console.error('Request failed:', err?.name || 'Error');
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
}
