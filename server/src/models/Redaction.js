import mongoose from 'mongoose';
const redactionSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, fileType: { type: String, enum: ['png', 'jpeg', 'pdf'], required: true }, counts: { email: { type: Number, default: 0 }, phone: { type: Number, default: 0 }, identifier: { type: Number, default: 0 }, manual: { type: Number, default: 0 } } }, { timestamps: true });
export default mongoose.model('Redaction', redactionSchema);
