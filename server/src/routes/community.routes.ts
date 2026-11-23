import { Router } from 'express';
import { CommunityController } from '../controllers/community.controller.js';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware.js';

const router = Router();

// Get community details by game ID
router.get('/by-game/:gameId', CommunityController.getCommunityByGameId);

// Get post details with its threaded comments
router.get('/posts/:postId', optionalAuth, CommunityController.getPostWithComments);

// Add a comment / reply to a post
router.post('/posts/:postId/comments', requireAuth, CommunityController.createComment);

// Toggle upvote / reaction on post
router.post('/posts/:postId/react', requireAuth, CommunityController.toggleReaction);

// Get community by community ID
router.get('/:id', CommunityController.getCommunityById);

// List all posts for a community
router.get('/:communityId/posts', optionalAuth, CommunityController.getCommunityPosts);

// Create a post in a community
router.post('/:communityId/posts', requireAuth, CommunityController.createPost);

export default router;
