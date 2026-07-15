const connectDB = require('../src/config/db');
const mongoose = require('mongoose');
const { rollupAllUsersForDate, yesterdayStr } = require('../src/jobs/attendanceJobs');

(async () => {
  await connectDB();
  const date = process.argv[2] || yesterdayStr(); // optional YYYY-MM-DD
  const res = await rollupAllUsersForDate(date);
  console.log('done:', res);
  await mongoose.disconnect();
})();
