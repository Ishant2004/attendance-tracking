const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { port } = require('./config/env');
const { scheduleJobs } = require('./jobs/attendanceJobs');
const { initSocket } = require('./socket');

(async () => {
  try {
    await connectDB();
    scheduleJobs();
    const server = http.createServer(app);
    initSocket(server); // attach Socket.IO to the same HTTP server
    server.listen(port, () => console.log(`Server running on port ${port}`));
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
})();