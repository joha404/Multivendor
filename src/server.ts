import 'dotenv/config';
import app from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';

const port = Number(process.env.PORT) || 5000;

const startServer = async (): Promise<void> => {
  try {
    await connectDatabase();

    const server = app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });

    const shutdown = async (): Promise<void> => {
      await disconnectDatabase();
      server.close(() => process.exit(0));
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('SIGUSR2', shutdown);
  } catch (error) {
    console.error('Server could not start because the database is unavailable');
    process.exit(1);
  }
};

void startServer();
