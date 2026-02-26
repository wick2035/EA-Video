const jwt = require('jsonwebtoken');

/**
 * Generate an API JWT token for admin authentication
 */
function generateApiToken(payload) {
  return jwt.sign(payload, process.env.API_SECRET, { expiresIn: '24h' });
}

/**
 * Verify an API JWT token
 */
function verifyApiToken(token) {
  return jwt.verify(token, process.env.API_SECRET);
}

module.exports = { generateApiToken, verifyApiToken };
