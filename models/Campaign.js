import mongoose from 'mongoose';

const recipientSchema = new mongoose.Schema({
  email: { type: String, required: true },
  status: {
    type: String,
    enum: ['sent', 'failed', 'bounced'],
    required: true
  },
  sentAt: { type: Date, default: Date.now },
  error: { type: String }
});

const campaignSchema = new mongoose.Schema({
  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Manager',
    required: true
  },
  managerEmail: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  template: {
    type: String,
    default: 'default'
  },
  status: {
    type: String,
    enum: ['starting', 'sending', 'completed', 'failed', 'paused'],
    default: 'starting'
  },
  totalRecipients: {
    type: Number,
    required: true
  },
  sentCount: {
    type: Number,
    default: 0
  },
  failedCount: {
    type: Number,
    default: 0
  },
  recipients: [recipientSchema],
  error: { type: String },
  completedAt: { type: Date }
}, {
  timestamps: true
});

const Campaign = mongoose.model('Campaign', campaignSchema);
export default Campaign;