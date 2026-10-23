import 'dotenv/config';
import mongoose from 'mongoose';
import app from './app.js';
const { PORT = 4000, MONGODB_URI, JWT_SECRET } = process.env;
if (!MONGODB_URI || !JWT_SECRET || JWT_SECRET.length < 32) throw new Error('Set MONGODB_URI and a JWT_SECRET of at least 32 characters in server/.env.');
await mongoose.connect(MONGODB_URI);
app.listen(PORT, () => console.log(`ShareSafe API listening on port ${PORT}`));
