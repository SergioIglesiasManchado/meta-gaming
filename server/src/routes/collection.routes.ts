import { Router } from 'express';
import { CollectionController } from '../controllers/collection.controller.js';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware.js';

export const collectionRouter = Router();

// Public / optionally authenticated routes
collectionRouter.get('/', optionalAuth, CollectionController.getCollections);
collectionRouter.get('/:id', optionalAuth, CollectionController.getCollectionById);

// Authenticated collection management routes
collectionRouter.post('/', requireAuth, CollectionController.createCollection);
collectionRouter.patch('/:id', requireAuth, CollectionController.updateCollection);
collectionRouter.delete('/:id', requireAuth, CollectionController.deleteCollection);

// Game membership routes
collectionRouter.post('/:id/games', requireAuth, CollectionController.addGame);
collectionRouter.delete('/:id/games/:gameId', requireAuth, CollectionController.removeGame);

export default collectionRouter;
