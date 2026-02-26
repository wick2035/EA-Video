const router = require('express').Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

// Public routes
router.post('/auth/login', authController.login);

// Protected routes
router.use('/patients', authMiddleware, require('./patients'));
router.use('/doctors', authMiddleware, require('./doctors'));
router.use('/meetings', authMiddleware, require('./meetings'));
router.use('/config', authMiddleware, require('./config'));

module.exports = router;
