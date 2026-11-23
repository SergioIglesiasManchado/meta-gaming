import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { ChatService } from '../services/chat.service.js';

export class ChatController {
  static async getConversations(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      const convs = await ChatService.getUserConversations(userId);
      res.status(200).json({
        status: 'success',
        data: convs,
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Server error' });
    }
  }

  static async getOrCreateDirectChat(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      const { recipientId } = req.body;
      const parsedId = parseInt(recipientId, 10);
      if (isNaN(parsedId)) {
        res.status(400).json({ status: 'error', message: 'Valid recipient ID is required' });
        return;
      }

      const conv = await ChatService.getOrCreateDirectChat(userId, parsedId);
      res.status(200).json({
        status: 'success',
        data: conv,
      });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message || 'Error starting chat' });
    }
  }

  static async createGroupChat(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      const { title, participantIds } = req.body;
      if (!title || !Array.isArray(participantIds)) {
        res.status(400).json({ status: 'error', message: 'Title and participantIds array required' });
        return;
      }

      const parsedIds = participantIds.map((id: any) => parseInt(id, 10)).filter((id: number) => !isNaN(id));
      const group = await ChatService.createGroupChat(userId, title, parsedIds);

      res.status(201).json({
        status: 'success',
        message: 'Group chat created',
        data: group,
      });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message || 'Error creating group chat' });
    }
  }

  static async getMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      const conversationId = parseInt(req.params.id, 10);
      if (isNaN(conversationId)) {
        res.status(400).json({ status: 'error', message: 'Invalid conversation ID' });
        return;
      }

      const messages = await ChatService.getConversationMessages(conversationId, userId);
      res.status(200).json({
        status: 'success',
        data: messages,
      });
    } catch (error: any) {
      const status = error.message.includes('Not authorized') ? 403 : 500;
      res.status(status).json({ status: 'error', message: error.message || 'Server error' });
    }
  }

  static async sendMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      const conversationId = parseInt(req.params.id, 10);
      if (isNaN(conversationId)) {
        res.status(400).json({ status: 'error', message: 'Invalid conversation ID' });
        return;
      }

      const { content } = req.body;
      if (!content || !content.trim()) {
        res.status(400).json({ status: 'error', message: 'Message content cannot be empty' });
        return;
      }

      const msg = await ChatService.sendMessage(conversationId, userId, content);
      res.status(201).json({
        status: 'success',
        data: msg,
      });
    } catch (error: any) {
      const status = error.message.includes('Not a participant') ? 403 : 400;
      res.status(status).json({ status: 'error', message: error.message || 'Error sending message' });
    }
  }

  static async markRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      const conversationId = parseInt(req.params.id, 10);
      if (isNaN(conversationId)) {
        res.status(400).json({ status: 'error', message: 'Invalid conversation ID' });
        return;
      }

      await ChatService.markConversationRead(conversationId, userId);
      res.status(200).json({ status: 'success' });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Server error' });
    }
  }
}
