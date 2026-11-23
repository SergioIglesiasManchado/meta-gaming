import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool, query } from '../src/db/index.js';
import { initDb } from '../src/db/init.js';

describe('Game Uploads & Review Updates Battery', () => {
  const app = createApp();
  let adminToken: string;
  let userToken: string;
  let userId: number;
  let testGameId: number;

  beforeAll(async () => {
    await initDb();

    // Authenticate admin
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ usernameOrEmail: 'admin', password: 'admin' });
    adminToken = adminLogin.body.data.token;

    // Register user
    const uname = `reviewer_${Date.now()}`;
    const userReg = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: uname, email: `${uname}@test.com`, password: 'password123' });
    userToken = userReg.body.data.token;
    userId = userReg.body.data.user.id;

    // Create test game
    const gameRes = await query(
      `INSERT INTO games (title, description, platforms, photos)
       VALUES ($1, $2, ARRAY['PC'], ARRAY[]::text[])
       RETURNING id`,
      [`Review Test Game ${Date.now()}`, 'A game for review and upload tests']
    );
    testGameId = gameRes.rows[0].id;
  });

  afterAll(async () => {
    if (testGameId) {
      await query('DELETE FROM reviews WHERE game_id = $1', [testGameId]);
      await query('DELETE FROM games WHERE id = $1', [testGameId]);
    }
    if (userId) {
      await query('DELETE FROM users WHERE id = $1', [userId]);
    }
    await pool.end();
  });

  it('allows admin to upload a valid image file', async () => {
    // 1x1 transparent PNG buffer
    const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

    const res = await request(app)
      .post('/api/v1/games/upload-image')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', pngBuffer, 'test-cover.png');

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.url).toBeDefined();
  });

  it('rejects image upload by regular users with 403', async () => {
    const pngBuffer = Buffer.from('fake image content');

    const res = await request(app)
      .post('/api/v1/games/upload-image')
      .set('Authorization', `Bearer ${userToken}`)
      .attach('image', pngBuffer, 'test-cover.png');

    expect(res.status).toBe(403);
  });

  it('rejects files with non-image mime types with 400', async () => {
    const textBuffer = Buffer.from('hello world not an image');

    const res = await request(app)
      .post('/api/v1/games/upload-image')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', textBuffer, 'malicious.txt');

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('images are allowed');
  });

  it('rejects image files exceeding size limit with 400', async () => {
    // 4.5 MB buffer (limit is 4 MB)
    const bigBuffer = Buffer.alloc(4.5 * 1024 * 1024, 'a');

    const res = await request(app)
      .post('/api/v1/games/upload-image')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', bigBuffer, { filename: 'huge.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
  });

  it('submits a review for the game and calculates average score', async () => {
    const res = await request(app)
      .post(`/api/v1/games/${testGameId}/reviews`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ rating: 8, comment: 'Initial review: pretty good!' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.review.rating).toBe(8);

    // Fetch game to verify average score
    const gameRes = await request(app).get(`/api/v1/games/${testGameId}`);
    expect(gameRes.status).toBe(200);
    expect(Number(gameRes.body.data.game.average_rating)).toBe(8);
    expect(Number(gameRes.body.data.game.reviews_count)).toBe(1);
  });

  it('updates the existing review when submitted again and recalculates average score', async () => {
    const res = await request(app)
      .post(`/api/v1/games/${testGameId}/reviews`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ rating: 10, comment: 'Updated review: absolute masterpiece!' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.review.rating).toBe(10);
    expect(res.body.data.review.comment).toBe('Updated review: absolute masterpiece!');

    // Fetch game to verify updated average rating and reviews count
    const gameRes = await request(app).get(`/api/v1/games/${testGameId}`);
    expect(gameRes.status).toBe(200);
    expect(Number(gameRes.body.data.game.average_rating)).toBe(10);
    expect(Number(gameRes.body.data.game.reviews_count)).toBe(1); // Count stays 1, was updated
  });
});
