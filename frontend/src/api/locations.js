import client from './client';

export const locationsApi = {
  list: (params) => client.get('/office-locations', { params }).then((r) => r.data.data.locations),
  create: (body) => client.post('/office-locations', body).then((r) => r.data.data.location),
  update: (id, body) => client.put(`/office-locations/${id}`, body).then((r) => r.data.data.location),
  deactivate: (id) => client.delete(`/office-locations/${id}`).then((r) => r.data.data.location),
};