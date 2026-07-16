import client from './client';

export const usersApi = {
  list: (params) => client.get('/users', { params }).then((r) => r.data.data.users),
  get: (id) => client.get(`/users/${id}`).then((r) => r.data.data.user),
  create: (body) => client.post('/users', body).then((r) => r.data.data.user),
  update: (id, body) => client.put(`/users/${id}`, body).then((r) => r.data.data.user),
  deactivate: (id) => client.delete(`/users/${id}`).then((r) => r.data.data.user),
};