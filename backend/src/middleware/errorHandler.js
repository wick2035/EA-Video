const logger = require('../utils/logger');

function errorHandler(err, req, res, _next) {
  logger.error(err.message, { stack: err.stack, url: req.url, method: req.method });

  const status = err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error',
  });
}

module.exports = errorHandler;
