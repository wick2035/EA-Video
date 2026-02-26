const { generateApiToken } = require('../utils/jwt');

// Simple admin authentication (hardcoded for demo)
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';

exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateApiToken({ username, role: 'admin' });
  res.json({ token, username, role: 'admin' });
};
