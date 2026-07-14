const app = require('./app');
const connectDB = require('./config/db');
const { port } = require('./config/env');

(async () => {
  try {
    await connectDB();
    app.listen(port, () => console.log(`Server running on port ${port}`));
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
})();