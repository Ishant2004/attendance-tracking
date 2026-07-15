import client from './client';

export const flagsApi = {
  forUser: (userId) => client.get(`/flags/${userId}`).then((r) => r.data.data.flags),
  forTeam: (teamId) => client.get(`/flags/team/${teamId}`).then((r) => r.data.data.flags),
  resolve: (id) => client.put(`/flags/${id}/resolve`).then((r) => r.data.data.flag),
};