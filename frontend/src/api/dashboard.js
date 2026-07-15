import client from './client';

export const dashboardApi = {
  individual: (userId, params) =>
    client.get(`/dashboard/individual/${userId}`, { params }).then((r) => r.data.data),
  team: (teamId, params) =>
    client.get(`/dashboard/team/${teamId}`, { params }).then((r) => r.data.data),
  leadership: (params) =>
    client.get('/dashboard/leadership', { params }).then((r) => r.data.data),
  wfoRatio: (params) =>
    client.get('/dashboard/wfo-wfh-ratio', { params }).then((r) => r.data.data),
  trends: (params) =>
    client.get('/dashboard/attendance-trends', { params }).then((r) => r.data.data),
};