const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// GET /api/users - Get all users with pagination
router.get('/', userController.getAllUsers);

// GET /api/users/:id - Get user by ID
router.get('/:id', userController.getUserById);

// POST /api/users - Create new user
router.post('/', userController.createUser);

// PUT /api/users/:id - Update user
router.put('/:id', userController.updateUser);

// DELETE /api/users/:id - Delete user
router.delete('/:id', userController.deleteUser);

// POST /api/users/:id/suspend - Suspend user
router.post('/:id/suspend', userController.suspendUser);

// POST /api/users/:id/unsuspend - Unsuspend user
router.post('/:id/unsuspend', userController.unsuspendUser);

// GET /api/users/:id/posts - Get user's posts
router.get('/:id/posts', userController.getUserPosts);

module.exports = router;