import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool, query } from '../src/db/index.js';
import { initDb } from '../src/db/init.js';

describe('Game Follow / Unfollow API Battery', () => {
  const app = createApp();
  let userToken: string;
  let userId: number;
  let testGameId: number;

  beforeAll(async () => {
    await initDb();

    // Register a test gamer
    const uname = `follower_${Date.now()}`;
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: uname, email: `${uname}@test.com`, password: 'password123' });
    userToken = regRes.body.data.token;
    userId = regRes.body.data.user.id;

    // Create a temporary test game
    const gameRes = await query(
      `INSERT INTO games (title, description, platforms, photos)
       VALUES ($1, $2, ARRAY['PC'], ARRAY[]::text[])
       RETURNING id`,
      [`Follow Test Game ${Date.now()}`, 'A game to test follow functionality']
    );
    testGameId = gameRes.rows[0].id;
  });

  afterAll(async () => {
    if (testGameId) {
      await query('DELETE FROM game_follows WHERE game_id = $1', [testGameId]);
      await query('DELETE FROM games WHERE id = $1', [testGameId]);
    }
    if (userId) {
      await query('DELETE FROM users WHERE id = $1', [userId]);
    }
    await pool.end();
  });

  it('initially reports follow status as false', async () => {
    const res = await request(app)
      .get(`/api/v1/games/${testGameId}/follow-status`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.is_following).toBe(false);
  });

  it('rejects follow status check when unauthenticated', async () => {
    const res = await request(app)
      .get(`/api/v1/games/${testGameId}/follow-status`);

    expect(res.status).toBe(401);
  });

  it('follows the game successfully', async () => {
    const res = await request(app)
      .post(`/api/v1/games/${testGameId}/follow`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.is_following).toBe(true);
  });

  it('reports follow status as true after following', async () => {
    const res = await request(app)
      .get(`/api/v1/games/${testGameId}/follow-status`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.is_following).toBe(true);
  });

  it('lists the followed game in the user followed games endpoint', async () => {
    const res = await request(app)
      .get('/api/v1/games/followed')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data.games)).toBe(true);
    const found = res.body.data.games.find((g: any) => g.id === testGameId);
    expect(found).toBeDefined();
    expect(found.title).toContain('Follow Test Game');
  });

  it('unfollows the game successfully', async () => {
    const res = await request(app)
      .delete(`/api/v1/games/${testGameId}/follow`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.is_following).toBe(false);
  });

  it('reports follow status as false after unfollowing', async () => {
    const res = await request(app)
      .get(`/api/v1/games/${testGameId}/follow-status`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.is_following).toBe(false);
  });

  it('no longer lists the game in followed games', async () => {
    const res = await request(app)
      .get('/api/v1/games/followed')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    const found = res.body.data.games.find((g: any) => g.id === testGameId);
    expect(found).toBeUndefined();
  });

  it('rejects following with an invalid game ID format', async () => {
    const res = await request(app)
      .post('/api/v1/games/not-a-number/follow')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(400);
  });
});
