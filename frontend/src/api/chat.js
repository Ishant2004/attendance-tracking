import client from './client';

export const chatApi = {
  list: () => client.get('/chat/conversations').then((r) => r.data.data.conversations),
  open: (userId) => client.post('/chat/conversations', { userId }).then((r) => r.data.data.conversation),
  messages: (id, params) =>
    client.get(`/chat/conversations/${id}/messages`, { params }).then((r) => r.data.data.messages),
  read: (id) => client.post(`/chat/conversations/${id}/read`).then((r) => r.data.data.conversation),
};
