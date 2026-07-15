const connectDB = require('../src/config/db');
const mongoose = require('mongoose');
const { runWeeklyDetection } = require('../src/jobs/attendanceJobs');

(async () => {
  await connectDB();
  const windowDays = Number(process.argv[2]) || 7; // optional
  const flags = await runWeeklyDetection({ windowDays });
  console.log('flags upserted:', flags.length);
  await mongoose.disconnect();
})();
