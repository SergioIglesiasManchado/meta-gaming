import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { ProfileService } from '../services/profile.service.js';

export class ProfileController {
  static async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.id, 10);
      if (isNaN(userId)) {
        res.status(400).json({ status: 'error', message: 'Invalid user ID' });
        return;
      }

      const profile = await ProfileService.getProfile(userId);
      if (!profile) {
        res.status(404).json({ status: 'error', message: 'User not found' });
        return;
      }

      res.status(200).json({
        status: 'success',
        data: profile,
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Server error' });
    }
  }

  static async updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.user?.id;
      if (!currentUserId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      const { bio, avatar_url, preferred_platforms } = req.body;
      const updated = await ProfileService.updateProfile(currentUserId, {
        bio,
        avatar_url,
        preferred_platforms,
      });

      res.status(200).json({
        status: 'success',
        message: 'Profile updated successfully',
        data: updated,
      });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message || 'Error updating profile' });
    }
  }

  static async getUserLibrary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.id, 10);
      if (isNaN(userId)) {
        res.status(400).json({ status: 'error', message: 'Invalid user ID' });
        return;
      }

      const status = req.query.status as string | undefined;
      const search = req.query.search as string | undefined;

      const library = await ProfileService.getUserLibrary(userId, { status, search });
      res.status(200).json({
        status: 'success',
        data: library,
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Server error' });
    }
  }

  static async getGameTrack(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.user?.id;
      if (!currentUserId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      const gameId = parseInt(req.params.id, 10);
      if (isNaN(gameId)) {
        res.status(400).json({ status: 'error', message: 'Invalid game ID' });
        return;
      }

      const track = await ProfileService.getGameTrack(currentUserId, gameId);
      res.status(200).json({
        status: 'success',
        data: track,
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Server error' });
    }
  }

  static async trackGame(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.user?.id;
      if (!currentUserId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      const gameId = parseInt(req.params.id, 10);
      if (isNaN(gameId)) {
        res.status(400).json({ status: 'error', message: 'Invalid game ID' });
        return;
      }

      const { status, hours_played, platform, personal_score } = req.body;
      if (!status) {
        res.status(400).json({ status: 'error', message: 'Status is required' });
        return;
      }

      const track = await ProfileService.trackGame(currentUserId, gameId, {
        status,
        hours_played,
        platform,
        personal_score,
      });

      res.status(200).json({
        status: 'success',
        message: 'Game tracking updated',
        data: track,
      });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message || 'Error tracking game' });
    }
  }

  static async untrackGame(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.user?.id;
      if (!currentUserId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      const gameId = parseInt(req.params.id, 10);
      if (isNaN(gameId)) {
        res.status(400).json({ status: 'error', message: 'Invalid game ID' });
        return;
      }

      const removed = await ProfileService.untrackGame(currentUserId, gameId);
      if (!removed) {
        res.status(404).json({ status: 'error', message: 'Game not in tracking list' });
        return;
      }

      res.status(200).json({
        status: 'success',
        message: 'Game removed from library',
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Server error' });
    }
  }
}
