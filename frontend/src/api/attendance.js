import client from './client';

export const attendanceApi = {
  currentStatus: (userId) =>
    client.get(`/attendance-events/current-status/${userId}`).then((r) => r.data.data),
  checkIn: (coords) =>
    client.post('/attendance-events/check-in', coords).then((r) => r.data.data.event),
  checkOut: (coords) =>
    client.post('/attendance-events/check-out', coords).then((r) => r.data.data.event),
  records: (userId, params) =>
    client.get(`/attendance-records/${userId}`, { params }).then((r) => r.data.data.records),
};