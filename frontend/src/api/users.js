import client from './client';

export const usersApi = {
  list: (params) => client.get('/users', { params }).then((r) => r.data.data.users),
  create: (body) => client.post('/users', body).then((r) => r.data.data.user),
  deactivate: (id) => client.delete(`/users/${id}`).then((r) => r.data.data.user),
};