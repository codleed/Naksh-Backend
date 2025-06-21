const express = require('express');
const { requireAuth, withAuth, syncUser, checkSuspension } = require('../middleware/auth');
const authController = require('../controllers/authController');
const router = express.Router();

// GET /api/auth/me - Get current user profile
router.get('/me', requireAuth, syncUser, checkSuspension, authController.getCurrentUser);

// PUT /api/auth/profile - Update user profile
router.put('/profile', requireAuth, syncUser, checkSuspension, authController.updateProfile);

// POST /api/auth/complete-profile - Complete user profile after registration
router.post('/complete-profile', requireAuth, syncUser, authController.completeProfile);

// GET /api/auth/check-username - Check if username is available
router.get('/check-username', authController.checkUsername);

// DELETE /api/auth/account - Delete user account
router.delete('/account', requireAuth, syncUser, authController.deleteAccount);

// GET /api/auth/session - Get session information
router.get('/session', withAuth, authController.getSession);

module.exports = router;