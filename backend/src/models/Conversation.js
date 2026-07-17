const mongoose = require('mongoose');

// A 1:1 thread between two users. `key` is the sorted participant-id pair, so a
// conversation is unique per pair. `unread` maps a participant id → their unread count.
const conversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    key: { type: String, required: true, unique: true },
    lastMessage: { type: String, default: '' },
    lastMessageAt: { type: Date, default: null },
    unread: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1, lastMessageAt: -1 });

conversationSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    // Serialize the Map to a plain { userId: count } object.
    ret.unread = doc.unread ? Object.fromEntries(doc.unread) : {};
    return ret;
  },
});

module.exports = mongoose.model('Conversation', conversationSchema);
