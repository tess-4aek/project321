import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  id: { type: String, required: true },
  stage: {
    type: String,
    enum: ['pending', 'processing', 'success', 'error', 'retry'],
    default: 'pending'
  },
  createdAt: { type: Date, default: Date.now }
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
  clients: [
    { 
      email: { type: String, required: true } 
    },
  ]
}, {
  timestamps: true
});

const Manager = mongoose.model('Manager', managerSchema);
export default Manager;