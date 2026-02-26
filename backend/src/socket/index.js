const logger = require('../utils/logger');

function initSocket(io) {
  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Join dashboard room for real-time updates
    socket.on('join:dashboard', () => {
      socket.join('dashboard');
      logger.debug(`Socket ${socket.id} joined dashboard`);
    });

    // Join a specific meeting room
    socket.on('join:meeting', (meetingUuid) => {
      socket.join(`meeting:${meetingUuid}`);
      logger.debug(`Socket ${socket.id} joined meeting:${meetingUuid}`);
    });

    // Leave a meeting room
    socket.on('leave:meeting', (meetingUuid) => {
      socket.leave(`meeting:${meetingUuid}`);
      logger.debug(`Socket ${socket.id} left meeting:${meetingUuid}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });
}

module.exports = initSocket;
