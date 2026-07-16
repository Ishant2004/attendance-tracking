import client from './client';

export const authApi = {
  login: (email, password) =>
    client.post('/auth/login', { email, password }).then((r) => r.data.data),
  me: () => client.get('/auth/me').then((r) => r.data.data.user),
  logout: () => client.post('/auth/logout').then((r) => r.data),
  changePassword: (currentPassword, newPassword) =>
    client.post('/auth/change-password', { currentPassword, newPassword }).then((r) => r.data),
};