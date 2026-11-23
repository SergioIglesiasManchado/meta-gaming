import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool, query } from '../src/db/index.js';
import { initDb } from '../src/db/init.js';

describe('Game Collections API Battery (User & Official)', () => {
  const app = createApp();
  const timestamp = Date.now();

  const normalUser = {
    username: `curator_${timestamp}`,
    email: `curator_${timestamp}@example.com`,
    password: 'Password123!',
  };

  const otherUser = {
    username: `other_${timestamp}`,
    email: `other_${timestamp}@example.com`,
    password: 'Password123!',
  };

  let normalToken: string;
  let normalUserId: number;

  let otherToken: string;
  let otherUserId: number;

  let adminToken: string;

  let testGameId1: number;
  let testGameId2: number;
  let userColId: number;
  let officialColId: number;

  beforeAll(async () => {
    await initDb();

    // Admin login
    const adminRes = await request(app).post('/api/v1/auth/login').send({
      usernameOrEmail: 'admin',
      password: 'admin',
    });
    adminToken = adminRes.body.data.token;

    // Normal user registration
    const u1Res = await request(app).post('/api/v1/auth/register').send(normalUser);
    normalToken = u1Res.body.data.token;
    normalUserId = u1Res.body.data.user.id;

    // Other user registration
    const u2Res = await request(app).post('/api/v1/auth/register').send(otherUser);
    otherToken = u2Res.body.data.token;
    otherUserId = u2Res.body.data.user.id;

    // Seed 2 games
    const g1 = await query<{ id: number }>(
      'INSERT INTO games (title, description, platforms) VALUES ($1, $2, $3) RETURNING id',
      [`Col Game 1 ${timestamp}`, 'Test Desc 1', ['PC']]
    );
    testGameId1 = g1.rows[0].id;

    const g2 = await query<{ id: number }>(
      'INSERT INTO games (title, description, platforms) VALUES ($1, $2, $3) RETURNING id',
      [`Col Game 2 ${timestamp}`, 'Test Desc 2', ['PlayStation 5']]
    );
    testGameId2 = g2.rows[0].id;
  });

  afterAll(async () => {
    await query('DELETE FROM collections WHERE user_id IN ($1, $2)', [normalUserId, otherUserId]);
    await query('DELETE FROM games WHERE id IN ($1, $2)', [testGameId1, testGameId2]);
    await query('DELETE FROM users WHERE id IN ($1, $2)', [normalUserId, otherUserId]);
    await pool.end();
  });

  it('allows admin to create an Official Collection', async () => {
    const res = await request(app)
      .post('/api/v1/collections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `GOTY Nominees ${timestamp}`,
        description: 'Official Metagaming curated Game of the Year nominees.',
        is_official: true,
        is_public: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.is_official).toBe(true);
    expect(res.body.data.title).toContain('GOTY Nominees');
    officialColId = res.body.data.id;
  });

  it('allows regular user to create custom collection, but prevents setting is_official to true', async () => {
    const res = await request(app)
      .post('/api/v1/collections')
      .set('Authorization', `Bearer ${normalToken}`)
      .send({
        title: `My Cozy Night Gaming ${timestamp}`,
        description: 'Best cozy games to play when relaxing.',
        is_official: true, // Should be ignored because user is not admin
        is_public: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.is_official).toBe(false);
    expect(res.body.data.title).toContain('My Cozy Night Gaming');
    userColId = res.body.data.id;
  });

  it('adds games to collection by owner', async () => {
    const res = await request(app)
      .post(`/api/v1/collections/${userColId}/games`)
      .set('Authorization', `Bearer ${normalToken}`)
      .send({ gameId: testGameId1 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.game_id).toBe(testGameId1);
  });

  it('prevents non-owner from adding games to another user collection', async () => {
    const res = await request(app)
      .post(`/api/v1/collections/${userColId}/games`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ gameId: testGameId2 });

    expect(res.status).toBe(403);
    expect(res.body.status).toBe('error');
  });

  it('retrieves collection by ID with game list and metadata', async () => {
    const res = await request(app).get(`/api/v1/collections/${userColId}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.id).toBe(userColId);
    expect(res.body.data.games_count).toBe(1);
    expect(res.body.data.games[0].id).toBe(testGameId1);
    expect(res.body.data.games[0].title).toContain('Col Game 1');
  });

  it('lists collections and filters official collections', async () => {
    const officialRes = await request(app).get('/api/v1/collections?official=true');
    expect(officialRes.status).toBe(200);
    expect(officialRes.body.status).toBe('success');
    const hasOfficial = officialRes.body.data.some((c: any) => c.id === officialColId);
    expect(hasOfficial).toBe(true);

    const userRes = await request(app).get('/api/v1/collections?official=false');
    expect(userRes.status).toBe(200);
    const hasUser = userRes.body.data.some((c: any) => c.id === userColId);
    expect(hasUser).toBe(true);
  });

  it('updates collection title and description by owner', async () => {
    const res = await request(app)
      .patch(`/api/v1/collections/${userColId}`)
      .set('Authorization', `Bearer ${normalToken}`)
      .send({
        title: `Updated Cozy Gaming ${timestamp}`,
        description: 'New description for cozy gaming.',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toContain('Updated Cozy Gaming');
    expect(res.body.data.description).toBe('New description for cozy gaming.');
  });

  it('removes game from collection by owner', async () => {
    const res = await request(app)
      .delete(`/api/v1/collections/${userColId}/games/${testGameId1}`)
      .set('Authorization', `Bearer ${normalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');

    const verify = await request(app).get(`/api/v1/collections/${userColId}`);
    expect(verify.body.data.games_count).toBe(0);
  });

  it('deletes collection by owner', async () => {
    const res = await request(app)
      .delete(`/api/v1/collections/${userColId}`)
      .set('Authorization', `Bearer ${normalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');

    const notFoundRes = await request(app).get(`/api/v1/collections/${userColId}`);
    expect(notFoundRes.status).toBe(404);
  });
});
