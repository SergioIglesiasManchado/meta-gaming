import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { SocialService } from '../services/social.service.js';

export class SocialController {
  static async sendFriendRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const requesterId = req.user?.id;
      if (!requesterId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      const { targetUserId } = req.body;
      const parsedTargetId = parseInt(targetUserId, 10);
      if (isNaN(parsedTargetId)) {
        res.status(400).json({ status: 'error', message: 'Valid targetUserId is required' });
        return;
      }

      const friendship = await SocialService.sendFriendRequest(requesterId, parsedTargetId);
      res.status(200).json({
        status: 'success',
        message: friendship.status === 'accepted' ? 'Friend request accepted!' : 'Friend request sent',
        data: friendship,
      });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message || 'Error sending friend request' });
    }
  }

  static async respondFriendRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      const requestId = parseInt(req.params.id, 10);
      const { action } = req.body; // 'accepted' or 'declined'

      if (isNaN(requestId) || !['accepted', 'declined'].includes(action)) {
        res.status(400).json({ status: 'error', message: 'Valid request ID and action (accepted/declined) required' });
        return;
      }

      const friendship = await SocialService.respondFriendRequest(userId, requestId, action);
      res.status(200).json({
        status: 'success',
        message: `Friend request ${action}`,
        data: friendship,
      });
    } catch (error: any) {
      const status = error.message.includes('Not authorized') ? 403 : 400;
      res.status(status).json({ status: 'error', message: error.message || 'Error responding to request' });
    }
  }

  static async getFriends(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      const friends = await SocialService.getFriends(userId);
      res.status(200).json({
        status: 'success',
        data: friends,
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Server error' });
    }
  }

  static async getPendingRequests(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      const requests = await SocialService.getPendingRequests(userId);
      res.status(200).json({
        status: 'success',
        data: requests,
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Server error' });
    }
  }

  static async getFriendshipStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      const otherUserId = parseInt(req.params.targetId, 10);
      if (isNaN(otherUserId)) {
        res.status(400).json({ status: 'error', message: 'Invalid target user ID' });
        return;
      }

      const status = await SocialService.getFriendshipStatus(userId, otherUserId);
      res.status(200).json({
        status: 'success',
        data: { status },
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Server error' });
    }
  }

  static async searchGamers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const gamers = await SocialService.searchGamers(userId, q);

      res.status(200).json({
        status: 'success',
        data: gamers,
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Error searching gamers' });
    }
  }
}
