const asyncHandler = require('../utils/asyncHandler');
const chatService = require('../services/chatService');
const { broadcastMessage } = require('../socket');

const listConversations = asyncHandler(async (req, res) => {
  const conversations = await chatService.listConversations(req.user.id);
  res.json({ success: true, data: { conversations } });
});

const openConversation = asyncHandler(async (req, res) => {
  const conversation = await chatService.getOrCreateConversation(req.user.id, req.body.userId);
  res.status(201).json({ success: true, data: { conversation } });
});

const getMessages = asyncHandler(async (req, res) => {
  const { before, limit } = req.query;
  const messages = await chatService.getMessages(req.user.id, req.params.id, { before, limit });
  res.json({ success: true, data: { messages } });
});

const sendMessage = asyncHandler(async (req, res) => {
  const { message, conversation } = await chatService.sendToConversation(
    req.user.id,
    req.params.id,
    req.body.body
  );
  await broadcastMessage(message, conversation); // push to any connected sockets too
  res.status(201).json({ success: true, data: { message } });
});

const markRead = asyncHandler(async (req, res) => {
  const conversation = await chatService.markRead(req.user.id, req.params.id);
  res.json({ success: true, data: { conversation } });
});

module.exports = { listConversations, openConversation, getMessages, sendMessage, markRead };
