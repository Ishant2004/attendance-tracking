import client from './client';

export const holidaysApi = {
  list: (params) => client.get('/holidays', { params }).then((r) => r.data.data.holidays),
  create: (body) => client.post('/holidays', body).then((r) => r.data.data.holiday),
  remove: (id) => client.delete(`/holidays/${id}`).then((r) => r.data.data.holiday),
};
