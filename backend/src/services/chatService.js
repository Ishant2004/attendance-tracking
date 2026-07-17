const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

// Deterministic key for a pair, so a conversation is unique per pair of users.
function keyFor(a, b) {
  return [String(a), String(b)].sort().join(':');
}

const isParticipant = (conv, userId) => conv.participants.some((p) => String(p._id || p) === String(userId));

async function getOrCreateConversation(meId, otherId) {
  if (String(meId) === String(otherId)) throw new ApiError(400, 'You cannot message yourself');
  const other = await User.findById(otherId);
  if (!other || !other.isActive) throw new ApiError(404, 'User not found');

  const key = keyFor(meId, otherId);
  let conv = await Conversation.findOne({ key });
  if (!conv) conv = await Conversation.create({ participants: [meId, otherId], key, unread: {} });
  await conv.populate('participants', 'name role');
  return conv;
}

async function listConversations(meId) {
  return Conversation.find({ participants: meId })
    .populate('participants', 'name role')
    .sort({ lastMessageAt: -1, updatedAt: -1 });
}

async function getMessages(meId, conversationId, { before, limit = 50 } = {}) {
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw new ApiError(404, 'Conversation not found');
  if (!isParticipant(conv, meId)) throw new ApiError(403, 'Forbidden');

  const q = { conversation: conversationId };
  if (before) q.createdAt = { $lt: new Date(before) };
  const msgs = await Message.find(q).sort({ createdAt: -1 }).limit(Math.min(Number(limit) || 50, 100));
  return msgs.reverse(); // chronological
}

async function sendMessage(meId, otherId, body) {
  const text = (body || '').trim();
  if (!text) throw new ApiError(400, 'Message cannot be empty');
  if (text.length > 4000) throw new ApiError(400, 'Message too long');

  const conv = await getOrCreateConversation(meId, otherId);
  const message = await Message.create({ conversation: conv._id, sender: meId, body: text });

  conv.lastMessage = text.slice(0, 200);
  conv.lastMessageAt = message.createdAt;
  conv.unread.set(String(otherId), (conv.unread.get(String(otherId)) || 0) + 1);
  await conv.save();

  return { message, conversation: conv };
}

// Send by conversation id (derives the other participant) — used by the REST endpoint.
async function sendToConversation(meId, conversationId, body) {
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw new ApiError(404, 'Conversation not found');
  if (!isParticipant(conv, meId)) throw new ApiError(403, 'Forbidden');
  const otherId = conv.participants.find((p) => String(p) !== String(meId));
  return sendMessage(meId, otherId, body);
}

async function markRead(meId, conversationId) {
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw new ApiError(404, 'Conversation not found');
  if (!isParticipant(conv, meId)) throw new ApiError(403, 'Forbidden');

  conv.unread.set(String(meId), 0);
  await conv.save();
  await Message.updateMany(
    { conversation: conversationId, sender: { $ne: meId }, readAt: null },
    { $set: { readAt: new Date() } }
  );
  await conv.populate('participants', 'name role');
  return conv;
}

module.exports = {
  keyFor,
  getOrCreateConversation,
  listConversations,
  getMessages,
  sendMessage,
  sendToConversation,
  markRead,
};
