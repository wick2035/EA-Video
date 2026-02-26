require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { sequelize } = require('./models');
const meetingService = require('./services/meetingService');
const initSocket = require('./socket');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    // Test database connection
    await sequelize.authenticate();
    logger.info('Database connection established');

    // Sync models (create tables if not exist)
    await sequelize.sync({ alter: false });
    logger.info('Database models synced');

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize Socket.io
    const io = new Server(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
      },
    });

    initSocket(io);
    app.set('io', io);
    meetingService.setIo(io);

    // Start server
    server.listen(PORT, () => {
      logger.info(`EA-Video Backend running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
