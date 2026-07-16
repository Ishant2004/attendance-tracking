import client from './client';

export const teamsApi = {
  list: () => client.get('/teams').then((r) => r.data.data.teams),
  managed: () => client.get('/teams/managed').then((r) => r.data.data.teams),
  create: (body) => client.post('/teams', body).then((r) => r.data.data.team),
  update: (id, body) => client.put(`/teams/${id}`, body).then((r) => r.data.data.team),
};