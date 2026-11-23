import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool, query } from '../src/db/index.js';
import { initDb } from '../src/db/init.js';

describe('Community Post Types & Reactions API Battery', () => {
  const app = createApp();
  const timestamp = Date.now();

  const author = {
    username: `post_author_${timestamp}`,
    email: `author_${timestamp}@example.com`,
    password: 'Password123!',
  };

  const voter = {
    username: `post_voter_${timestamp}`,
    email: `voter_${timestamp}@example.com`,
    password: 'Password123!',
  };

  let authorToken: string;
  let authorId: number;

  let voterToken: string;
  let voterId: number;

  let testCommunityId: number;
  let guidePostId: number;
  let screenshotPostId: number;

  beforeAll(async () => {
    await initDb();

    const aRes = await request(app).post('/api/v1/auth/register').send(author);
    authorToken = aRes.body.data.token;
    authorId = aRes.body.data.user.id;

    const vRes = await request(app).post('/api/v1/auth/register').send(voter);
    voterToken = vRes.body.data.token;
    voterId = vRes.body.data.user.id;

    // Create a game and community
    const gRes = await query<{ id: number }>(
      'INSERT INTO games (title, description, platforms) VALUES ($1, $2, $3) RETURNING id',
      [`Community Game ${timestamp}`, 'Description', ['PC']]
    );
    const gameId = gRes.rows[0].id;

    const cRes = await query<{ id: number }>(
      'INSERT INTO communities (game_id, name, description) VALUES ($1, $2, $3) RETURNING id',
      [gameId, `Community Game ${timestamp}`, 'Description']
    );
    testCommunityId = cRes.rows[0].id;
  });

  afterAll(async () => {
    await query('DELETE FROM communities WHERE id = $1', [testCommunityId]);
    await query('DELETE FROM users WHERE id IN ($1, $2)', [authorId, voterId]);
    await pool.end();
  });

  it('creates post with post_type="guide" and optional media_url', async () => {
    const res = await request(app)
      .post(`/api/v1/communities/${testCommunityId}/posts`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'Beginner Boss Guide & Strategy',
        content: 'Here are the 5 essential tips to beat the first boss without dying.',
        post_type: 'guide',
        media_url: 'https://example.com/guide-diagram.png',
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.post.post_type).toBe('guide');
    expect(res.body.data.post.media_url).toBe('https://example.com/guide-diagram.png');
    guidePostId = res.body.data.post.id;
  });

  it('creates post with post_type="screenshot"', async () => {
    const res = await request(app)
      .post(`/api/v1/communities/${testCommunityId}/posts`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        title: 'Sunset over the crystal peaks',
        content: 'Captured this stunning view during photo mode in 4K!',
        post_type: 'screenshot',
        media_url: 'https://example.com/sunset.jpg',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.post.post_type).toBe('screenshot');
    screenshotPostId = res.body.data.post.id;
  });

  it('filters community posts by type', async () => {
    const guideRes = await request(app).get(
      `/api/v1/communities/${testCommunityId}/posts?type=guide`
    );
    expect(guideRes.status).toBe(200);
    expect(guideRes.body.data.posts.length).toBe(1);
    expect(guideRes.body.data.posts[0].post_type).toBe('guide');

    const screenRes = await request(app).get(
      `/api/v1/communities/${testCommunityId}/posts?type=screenshot`
    );
    expect(screenRes.status).toBe(200);
    expect(screenRes.body.data.posts.length).toBe(1);
    expect(screenRes.body.data.posts[0].post_type).toBe('screenshot');
  });

  it('toggles upvote on a post by user', async () => {
    // 1. Upvote
    const voteRes = await request(app)
      .post(`/api/v1/communities/posts/${guidePostId}/react`)
      .set('Authorization', `Bearer ${voterToken}`);

    expect(voteRes.status).toBe(200);
    expect(voteRes.body.data.upvoted).toBe(true);
    expect(voteRes.body.data.upvotes_count).toBe(1);

    // Verify post retrieval includes has_upvoted and upvotes_count
    const postRes = await request(app)
      .get(`/api/v1/communities/posts/${guidePostId}`)
      .set('Authorization', `Bearer ${voterToken}`);
    expect(postRes.body.data.post.upvotes_count).toBe(1);
    expect(postRes.body.data.post.has_upvoted).toBe(true);

    // 2. Toggle off
    const unvoteRes = await request(app)
      .post(`/api/v1/communities/posts/${guidePostId}/react`)
      .set('Authorization', `Bearer ${voterToken}`);

    expect(unvoteRes.status).toBe(200);
    expect(unvoteRes.body.data.upvoted).toBe(false);
    expect(unvoteRes.body.data.upvotes_count).toBe(0);
  });
});
