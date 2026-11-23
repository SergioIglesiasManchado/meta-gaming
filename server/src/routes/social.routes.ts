import { Router } from 'express';
import { SocialController } from '../controllers/social.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const socialRouter = Router();

socialRouter.use(requireAuth);

socialRouter.get('/friends', SocialController.getFriends);
socialRouter.get('/search', SocialController.searchGamers);
socialRouter.get('/requests', SocialController.getPendingRequests);
socialRouter.post('/requests', SocialController.sendFriendRequest);
socialRouter.patch('/requests/:id', SocialController.respondFriendRequest);
socialRouter.get('/status/:targetId', SocialController.getFriendshipStatus);

export default socialRouter;
