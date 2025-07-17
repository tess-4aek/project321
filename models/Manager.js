import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  id: { type: String, required: true },
  stage: {
    type: String,
    enum: ['pending', 'processing', 'success', 'error', 'retry', 'skipped', 'failed_permanently'],
    default: 'pending'
  },
  retryCount: { type: Number, default: 0 },
  lastError: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const clientSchema = new mongoose.Schema({
  email: { type: String, required: true },
  name: { type: String, default: '' },
  status: {
    type: String,
    enum: ['active', 'inactive', 'bounced'],
    default: 'active'
  },
  notes: { type: String, default: '' },
  addedAt: { type: Date, default: Date.now },
  lastEmailSent: { type: Date },
  responseCount: { type: Number, default: 0 }
});

const managerSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
  },
  accessToken: {
    type: String,
    required: true
  },
  refreshToken: {
    type: String,
    required: true
  },
  tokenExpiryDate: {
    type: Date,
    required: false
  },
  messages: [messageSchema],
  clients: [clientSchema]
}, {
  timestamps: true
});

const Manager = mongoose.model('Manager', managerSchema);
export default Manager;