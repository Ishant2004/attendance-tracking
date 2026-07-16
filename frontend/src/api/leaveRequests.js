import client from './client';

export const leaveApi = {
  // { type: 'leave' | 'half_day', fromDate, toDate?, reason? }
  create: (body) => client.post('/leave-requests', body).then((r) => r.data.data.request),
  mine: () => client.get('/leave-requests/mine').then((r) => r.data.data.requests),
  inbox: () => client.get('/leave-requests/inbox').then((r) => r.data.data.requests),
  approve: (id) => client.put(`/leave-requests/${id}/approve`).then((r) => r.data.data.request),
  reject: (id) => client.put(`/leave-requests/${id}/reject`).then((r) => r.data.data.request),
  cancel: (id) => client.put(`/leave-requests/${id}/cancel`).then((r) => r.data.data.request),
};
