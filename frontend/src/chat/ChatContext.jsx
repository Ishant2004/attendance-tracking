import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../auth/AuthContext';
import { chatApi } from '../api/chat';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const ChatContext = createContext(null);
export const useChat = () => useContext(ChatContext);

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const myId = String(user._id || user.id);

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState({}); // { [conversationId]: Message[] }
  const [activeId, setActiveId] = useState(null);
  const [connected, setConnected] = useState(false);

  const socketRef = useRef(null);
  const activeRef = useRef(null);
  activeRef.current = activeId;

  const sortByRecent = (list) =>
    [...list].sort(
      (a, b) => new Date(b.lastMessageAt || b.updatedAt || 0) - new Date(a.lastMessageAt || a.updatedAt || 0)
    );

  const upsertConversation = useCallback((conv) => {
    setConversations((prev) => sortByRecent([conv, ...prev.filter((c) => c._id !== conv._id)]));
  }, []);

  const markRead = useCallback(
    (id) => {
      socketRef.current?.emit('chat:read', { conversationId: id });
      setConversations((prev) =>
        prev.map((c) => (c._id === id ? { ...c, unread: { ...c.unread, [myId]: 0 } } : c))
      );
    },
    [myId]
  );

  // Initial conversation load + persistent socket.
  useEffect(() => {
    let mounted = true;
    chatApi
      .list()
      .then((cs) => mounted && setConversations(sortByRecent(cs)))
      .catch(() => {});

    const socket = io(API_URL, {
      auth: (cb) => cb({ token: localStorage.getItem('accessToken') }),
    });
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('chat:message', ({ message, conversation }) => {
      setMessages((prev) => {
        const list = prev[conversation._id] || [];
        if (list.some((m) => m._id === message._id)) return prev;
        return { ...prev, [conversation._id]: [...list, message] };
      });
      let conv = conversation;
      // If I'm currently looking at this thread, treat it as read right away.
      if (activeRef.current === conversation._id) {
        socket.emit('chat:read', { conversationId: conversation._id });
        conv = { ...conversation, unread: { ...conversation.unread, [myId]: 0 } };
      }
      upsertConversation(conv);
    });

    return () => {
      mounted = false;
      socket.close();
      socketRef.current = null;
    };
  }, [myId, upsertConversation]);

  const loadMessages = useCallback(async (id) => {
    const msgs = await chatApi.messages(id);
    setMessages((prev) => ({ ...prev, [id]: msgs }));
  }, []);

  const openConversationById = useCallback(
    async (id) => {
      setActiveId(id);
      await loadMessages(id);
      markRead(id);
    },
    [loadMessages, markRead]
  );

  const openConversation = useCallback(
    async (otherUserId) => {
      const conv = await chatApi.open(otherUserId);
      upsertConversation(conv);
      setActiveId(conv._id);
      await loadMessages(conv._id);
      markRead(conv._id);
      return conv;
    },
    [loadMessages, markRead, upsertConversation]
  );

  const closeActive = useCallback(() => setActiveId(null), []);

  const sendMessage = useCallback(
    (toUserId, body) =>
      new Promise((resolve) => {
        if (!socketRef.current) return resolve({ ok: false, error: 'Not connected' });
        socketRef.current.emit('chat:send', { toUserId, body }, resolve);
      }),
    []
  );

  const totalUnread = conversations.reduce((n, c) => n + (c.unread?.[myId] || 0), 0);

  const value = {
    myId,
    conversations,
    messages,
    activeId,
    connected,
    totalUnread,
    openConversation,
    openConversationById,
    closeActive,
    sendMessage,
  };
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
