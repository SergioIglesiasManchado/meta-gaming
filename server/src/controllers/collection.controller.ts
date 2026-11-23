import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { CollectionService } from '../services/collection.service.js';

export class CollectionController {
  static async getCollections(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const isOfficialParam = req.query.official;
      const is_official = isOfficialParam !== undefined ? isOfficialParam === 'true' : undefined;
      const userIdParam = req.query.user_id as string | undefined;
      const user_id = userIdParam ? parseInt(userIdParam, 10) : undefined;
      const search = req.query.search as string | undefined;
      const current_user_id = req.user?.id;

      const collections = await CollectionService.getCollections({
        is_official,
        user_id,
        current_user_id,
        search,
      });

      res.status(200).json({
        status: 'success',
        data: collections,
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Server error' });
    }
  }

  static async getCollectionById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const collectionId = parseInt(req.params.id, 10);
      if (isNaN(collectionId)) {
        res.status(400).json({ status: 'error', message: 'Invalid collection ID' });
        return;
      }

      const collection = await CollectionService.getCollectionById(collectionId, req.user?.id);
      if (!collection) {
        res.status(404).json({ status: 'error', message: 'Collection not found' });
        return;
      }

      res.status(200).json({
        status: 'success',
        data: collection,
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Server error' });
    }
  }

  static async createCollection(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      const isAdmin = req.user?.role === 'admin';
      const { title, description, is_official, is_public } = req.body;

      if (!title || !title.trim()) {
        res.status(400).json({ status: 'error', message: 'Collection title is required' });
        return;
      }

      const collection = await CollectionService.createCollection(userId, isAdmin, {
        title,
        description,
        is_official,
        is_public,
      });

      res.status(201).json({
        status: 'success',
        message: 'Collection created successfully',
        data: collection,
      });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message || 'Error creating collection' });
    }
  }

  static async updateCollection(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      const collectionId = parseInt(req.params.id, 10);
      if (isNaN(collectionId)) {
        res.status(400).json({ status: 'error', message: 'Invalid collection ID' });
        return;
      }

      const isAdmin = req.user?.role === 'admin';
      const { title, description, is_official, is_public } = req.body;

      const updated = await CollectionService.updateCollection(collectionId, userId, isAdmin, {
        title,
        description,
        is_official,
        is_public,
      });

      res.status(200).json({
        status: 'success',
        message: 'Collection updated successfully',
        data: updated,
      });
    } catch (error: any) {
      const status = error.message.includes('Not authorized') ? 403 : 400;
      res.status(status).json({ status: 'error', message: error.message || 'Error updating collection' });
    }
  }

  static async deleteCollection(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      const collectionId = parseInt(req.params.id, 10);
      if (isNaN(collectionId)) {
        res.status(400).json({ status: 'error', message: 'Invalid collection ID' });
        return;
      }

      const isAdmin = req.user?.role === 'admin';
      const deleted = await CollectionService.deleteCollection(collectionId, userId, isAdmin);

      if (!deleted) {
        res.status(404).json({ status: 'error', message: 'Collection not found' });
        return;
      }

      res.status(200).json({
        status: 'success',
        message: 'Collection deleted successfully',
      });
    } catch (error: any) {
      const status = error.message.includes('Not authorized') ? 403 : 500;
      res.status(status).json({ status: 'error', message: error.message || 'Server error' });
    }
  }

  static async addGame(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      const collectionId = parseInt(req.params.id, 10);
      if (isNaN(collectionId)) {
        res.status(400).json({ status: 'error', message: 'Invalid collection ID' });
        return;
      }

      const { gameId } = req.body;
      const parsedGameId = parseInt(gameId, 10);
      if (isNaN(parsedGameId)) {
        res.status(400).json({ status: 'error', message: 'Valid game ID is required' });
        return;
      }

      const isAdmin = req.user?.role === 'admin';
      const record = await CollectionService.addGameToCollection(
        collectionId,
        parsedGameId,
        userId,
        isAdmin
      );

      res.status(200).json({
        status: 'success',
        message: 'Game added to collection',
        data: record,
      });
    } catch (error: any) {
      const status = error.message.includes('Not authorized') ? 403 : 400;
      res.status(status).json({ status: 'error', message: error.message || 'Error adding game to collection' });
    }
  }

  static async removeGame(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      const collectionId = parseInt(req.params.id, 10);
      const gameId = parseInt(req.params.gameId, 10);
      if (isNaN(collectionId) || isNaN(gameId)) {
        res.status(400).json({ status: 'error', message: 'Invalid collection ID or game ID' });
        return;
      }

      const isAdmin = req.user?.role === 'admin';
      const removed = await CollectionService.removeGameFromCollection(
        collectionId,
        gameId,
        userId,
        isAdmin
      );

      if (!removed) {
        res.status(404).json({ status: 'error', message: 'Game not in collection' });
        return;
      }

      res.status(200).json({
        status: 'success',
        message: 'Game removed from collection',
      });
    } catch (error: any) {
      const status = error.message.includes('Not authorized') ? 403 : 500;
      res.status(status).json({ status: 'error', message: error.message || 'Server error' });
    }
  }
}
