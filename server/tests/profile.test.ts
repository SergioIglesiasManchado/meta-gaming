import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool, query } from '../src/db/index.js';
import { initDb } from '../src/db/init.js';

describe('Gamer Profiles & Game Library Trackers API Battery', () => {
  const app = createApp();
  const timestamp = Date.now();
  const testUser = {
    username: `tracker_user_${timestamp}`,
    email: `tracker_${timestamp}@example.com`,
    password: 'Password123!',
  };

  let token: string;
  let userId: number;
  let testGameId: number;

  beforeAll(async () => {
    await initDb();

    // Register user
    const userRes = await request(app).post('/api/v1/auth/register').send(testUser);
    token = userRes.body.data.token;
    userId = userRes.body.data.user.id;

    // Create a test game
    const gameRes = await query<{ id: number }>(
      `INSERT INTO games (title, description, platforms, photos)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        `Tracking Game ${timestamp}`,
        'An awesome game to track playtime and completion metrics',
        ['PC', 'PlayStation 5'],
        ['https://images.unsplash.com/photo-1542751371-adc38448a05e'],
      ]
    );
    testGameId = gameRes.rows[0].id;
  });

  afterAll(async () => {
    await query('DELETE FROM game_tracks WHERE user_id = $1', [userId]);
    await query('DELETE FROM user_profiles WHERE user_id = $1', [userId]);
    await query('DELETE FROM games WHERE id = $1', [testGameId]);
    await query('DELETE FROM users WHERE id = $1', [userId]);
    await pool.end();
  });

  it('fetches gamer profile with default values and empty stats', async () => {
    const res = await request(app).get(`/api/v1/users/${userId}/profile`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.username).toBe(testUser.username);
    expect(res.body.data.stats.total_games_tracked).toBe(0);
    expect(res.body.data.stats.total_hours_played).toBe(0);
    expect(res.body.data.stats.games_by_status.want_to_play).toBe(0);
  });

  it('rejects updating profile when unauthenticated', async () => {
    const res = await request(app).patch('/api/v1/users/profile').send({
      bio: 'Gamer bio without token',
    });
    expect(res.status).toBe(401);
  });

  it('updates profile bio, avatar_url, and preferred_platforms', async () => {
    const res = await request(app)
      .patch('/api/v1/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        bio: 'Avid RPG and soulslike enjoyer.',
        avatar_url: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857',
        preferred_platforms: ['PC', 'Switch'],
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.bio).toBe('Avid RPG and soulslike enjoyer.');
    expect(res.body.data.avatar_url).toBe('https://images.unsplash.com/photo-1566492031773-4f4e44671857');
    expect(res.body.data.preferred_platforms).toContain('PC');
    expect(res.body.data.preferred_platforms).toContain('Switch');
  });

  it('records game tracking with status, hours, and personal rating', async () => {
    const res = await request(app)
      .post(`/api/v1/games/${testGameId}/track`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'playing',
        hours_played: 18.5,
        platform: 'PC',
        personal_score: 9.5,
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.status).toBe('playing');
    expect(res.body.data.hours_played).toBe(18.5);
    expect(res.body.data.platform).toBe('PC');
    expect(res.body.data.personal_score).toBe(9.5);
  });

  it('fetches tracking status for single game', async () => {
    const res = await request(app)
      .get(`/api/v1/games/${testGameId}/track`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.game_id).toBe(testGameId);
    expect(res.body.data.status).toBe('playing');
    expect(res.body.data.hours_played).toBe(18.5);
  });

  it('updates profile statistics dynamically based on tracked games', async () => {
    const res = await request(app).get(`/api/v1/users/${userId}/profile`);
    expect(res.status).toBe(200);
    expect(res.body.data.stats.total_games_tracked).toBe(1);
    expect(res.body.data.stats.total_hours_played).toBe(18.5);
    expect(res.body.data.stats.games_by_status.playing).toBe(1);
    expect(res.body.data.stats.games_by_status.completed).toBe(0);
  });

  it('fetches user library with tracked games and filters', async () => {
    const res = await request(app).get(`/api/v1/users/${userId}/library`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].game_id).toBe(testGameId);
    expect(res.body.data[0].game_title).toContain('Tracking Game');

    // Filter by matching status
    const matchFilter = await request(app).get(`/api/v1/users/${userId}/library?status=playing`);
    expect(matchFilter.body.data.length).toBe(1);

    // Filter by non-matching status
    const nonMatchFilter = await request(app).get(`/api/v1/users/${userId}/library?status=completed`);
    expect(nonMatchFilter.body.data.length).toBe(0);
  });

  it('rejects tracking with invalid status', async () => {
    const res = await request(app)
      .post(`/api/v1/games/${testGameId}/track`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'invalid_status_value',
        hours_played: 10,
      });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });

  it('rejects tracking with invalid personal score out of 0-10 bounds', async () => {
    const res = await request(app)
      .post(`/api/v1/games/${testGameId}/track`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'playing',
        personal_score: 11,
      });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });

  it('updates existing track to completed with updated hours', async () => {
    const res = await request(app)
      .post(`/api/v1/games/${testGameId}/track`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'completed',
        hours_played: 42.0,
        platform: 'PC',
        personal_score: 10,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.hours_played).toBe(42.0);

    const profileRes = await request(app).get(`/api/v1/users/${userId}/profile`);
    expect(profileRes.body.data.stats.games_by_status.completed).toBe(1);
    expect(profileRes.body.data.stats.games_by_status.playing).toBe(0);
  });

  it('untracks a game and removes it from user library', async () => {
    const res = await request(app)
      .delete(`/api/v1/games/${testGameId}/track`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');

    const libraryRes = await request(app).get(`/api/v1/users/${userId}/library`);
    expect(libraryRes.body.data.length).toBe(0);
  });

  it('returns 404 when untracking a game that is not tracked', async () => {
    const res = await request(app)
      .delete(`/api/v1/games/${testGameId}/track`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
