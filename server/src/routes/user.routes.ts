import { Router } from 'express';
import { UserController } from '../controllers/user.controller.js';
import { ProfileController } from '../controllers/profile.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';

export const userRouter = Router();

userRouter.patch('/profile', requireAuth, ProfileController.updateProfile);
userRouter.get('/:id/profile', ProfileController.getProfile);
userRouter.get('/:id/library', ProfileController.getUserLibrary);

userRouter.get('/', requireAuth, requireAdmin, UserController.searchUsers);
userRouter.get('/banned', requireAuth, requireAdmin, UserController.getBannedUsers);
userRouter.patch('/:id/role', requireAuth, requireAdmin, UserController.updateRole);
userRouter.patch('/:id/ban', requireAuth, requireAdmin, UserController.banUser);
userRouter.patch('/:id/unban', requireAuth, requireAdmin, UserController.unbanUser);
