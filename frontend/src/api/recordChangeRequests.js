import client from './client';

export const recordChangeApi = {
  // { date, requestedStatus, reason? }
  create: (body) => client.post('/record-change-requests', body).then((r) => r.data.data.request),
  mine: () => client.get('/record-change-requests/mine').then((r) => r.data.data.requests),
  inbox: () => client.get('/record-change-requests/inbox').then((r) => r.data.data.requests),
  approve: (id) => client.put(`/record-change-requests/${id}/approve`).then((r) => r.data.data.request),
  reject: (id) => client.put(`/record-change-requests/${id}/reject`).then((r) => r.data.data.request),
  cancel: (id) => client.put(`/record-change-requests/${id}/cancel`).then((r) => r.data.data.request),
};
