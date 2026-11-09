require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 3000;

const start = async () => {
  try {
    // Only start listening once the database connection succeeds
    await connectDB(process.env.MONGO_URI);
    // Express 5 calls this callback with an error if the port can't be used
    app.listen(PORT, (err) => {
      if (err) {
        console.error(`Could not listen on port ${PORT}: ${err.message}`);
        process.exit(1);
      }
      console.log(`Server listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
};

start();
