import client from './client';

export const teamsApi = {
  list: () => client.get('/teams').then((r) => r.data.data.teams),
  create: (body) => client.post('/teams', body).then((r) => r.data.data.team),
};