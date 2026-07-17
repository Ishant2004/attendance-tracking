const { Server } = require('socket.io');
const { verifyAccessToken } = require('./utils/jwt');
const User = require('./models/User');
const chatService = require('./services/chatService');

let io = null;

// Deliver an event to every socket a user has open (they join a room named by their id).
function emitToUser(userId, event, payload) {
  if (io) io.to(String(userId)).emit(event, payload);
}

// Broadcast a saved message to both participants' rooms.
async function broadcastMessage(message, conversation) {
  const payload = { message: message.toJSON(), conversation: conversation.toJSON() };
  for (const p of conversation.participants) emitToUser(p._id || p, 'chat:message', payload);
}

function initSocket(httpServer) {
  io = new Server(httpServer, { cors: { origin: '*' } });

  // JWT handshake: the client passes its access token in `auth.token`.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Unauthorized'));
      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.sub);
      if (!user || !user.isActive) return next(new Error('Unauthorized'));
      socket.userId = String(user._id);
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(socket.userId);

    socket.on('chat:send', async ({ toUserId, body } = {}, ack) => {
      try {
        const { message, conversation } = await chatService.sendMessage(socket.userId, toUserId, body);
        await broadcastMessage(message, conversation);
        if (typeof ack === 'function') ack({ ok: true, message: message.toJSON() });
      } catch (e) {
        if (typeof ack === 'function') ack({ ok: false, error: e.message });
      }
    });

    socket.on('chat:read', async ({ conversationId } = {}) => {
      try {
        await chatService.markRead(socket.userId, conversationId);
      } catch {
        /* ignore */
      }
    });
  });

  return io;
}

module.exports = { initSocket, emitToUser, broadcastMessage };
