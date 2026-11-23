import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const chatRouter = Router();

chatRouter.use(requireAuth);

chatRouter.get('/', ChatController.getConversations);
chatRouter.post('/direct', ChatController.getOrCreateDirectChat);
chatRouter.post('/group', ChatController.createGroupChat);
chatRouter.get('/:id/messages', ChatController.getMessages);
chatRouter.post('/:id/messages', ChatController.sendMessage);
chatRouter.patch('/:id/read', ChatController.markRead);

export default chatRouter;
