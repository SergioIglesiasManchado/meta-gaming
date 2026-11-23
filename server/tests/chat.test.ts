import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool, query } from '../src/db/index.js';
import { initDb } from '../src/db/init.js';

describe('Social Friends & 1-on-1 / Group Chat API Battery', () => {
  const app = createApp();
  const timestamp = Date.now();

  const userA = {
    username: `chat_a_${timestamp}`,
    email: `chat_a_${timestamp}@example.com`,
    password: 'Password123!',
  };

  const userB = {
    username: `chat_b_${timestamp}`,
    email: `chat_b_${timestamp}@example.com`,
    password: 'Password123!',
  };

  const userC = {
    username: `chat_c_${timestamp}`,
    email: `chat_c_${timestamp}@example.com`,
    password: 'Password123!',
  };

  let tokenA: string;
  let idA: number;

  let tokenB: string;
  let idB: number;

  let tokenC: string;
  let idC: number;

  let friendshipId: number;
  let directChatId: number;
  let groupChatId: number;

  beforeAll(async () => {
    await initDb();

    const resA = await request(app).post('/api/v1/auth/register').send(userA);
    tokenA = resA.body.data.token;
    idA = resA.body.data.user.id;

    const resB = await request(app).post('/api/v1/auth/register').send(userB);
    tokenB = resB.body.data.token;
    idB = resB.body.data.user.id;

    const resC = await request(app).post('/api/v1/auth/register').send(userC);
    tokenC = resC.body.data.token;
    idC = resC.body.data.user.id;
  });

  afterAll(async () => {
    await query('DELETE FROM chat_conversations WHERE created_by IN ($1, $2, $3)', [idA, idB, idC]);
    await query('DELETE FROM friendships WHERE requester_id IN ($1, $2, $3) OR addressee_id IN ($1, $2, $3)', [idA, idB, idC]);
    await query('DELETE FROM users WHERE id IN ($1, $2, $3)', [idA, idB, idC]);
    await pool.end();
  });

  it('user A sends friend request to user B', async () => {
    const res = await request(app)
      .post('/api/v1/social/requests')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ targetUserId: idB });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.status).toBe('pending');
    friendshipId = res.body.data.id;
  });

  it('reports correct friendship status from both perspectives', async () => {
    const statusA = await request(app)
      .get(`/api/v1/social/status/${idB}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(statusA.status).toBe(200);
    expect(statusA.body.data.status).toBe('pending_sent');

    const statusB = await request(app)
      .get(`/api/v1/social/status/${idA}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(statusB.status).toBe(200);
    expect(statusB.body.data.status).toBe('pending_received');
  });

  it('user B accepts friend request', async () => {
    const res = await request(app)
      .patch(`/api/v1/social/requests/${friendshipId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ action: 'accepted' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('accepted');

    const friendsRes = await request(app)
      .get('/api/v1/social/friends')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(friendsRes.status).toBe(200);
    expect(friendsRes.body.data.length).toBe(1);
    expect(friendsRes.body.data[0].user_id).toBe(idB);
  });

  it('creates 1-on-1 direct chat between user A and user B', async () => {
    const res = await request(app)
      .post('/api/v1/chats/direct')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ recipientId: idB });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.is_group).toBe(false);
    expect(res.body.data.participants.length).toBe(2);
    directChatId = res.body.data.id;
  });

  it('sends message in direct chat from user A', async () => {
    const res = await request(app)
      .post(`/api/v1/chats/${directChatId}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ content: 'Hey friend, ready for some co-op?' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.content).toBe('Hey friend, ready for some co-op?');
    expect(res.body.data.sender_id).toBe(idA);
  });

  it('user B receives message and unread count increases', async () => {
    const convsRes = await request(app)
      .get('/api/v1/chats')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(convsRes.status).toBe(200);
    const chat = convsRes.body.data.find((c: any) => c.id === directChatId);
    expect(chat).toBeDefined();
    expect(chat.unread_count).toBeGreaterThanOrEqual(1);

    // Reading messages marks as read
    const msgsRes = await request(app)
      .get(`/api/v1/chats/${directChatId}/messages`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(msgsRes.status).toBe(200);
    expect(msgsRes.body.data.length).toBe(1);
    expect(msgsRes.body.data[0].content).toContain('Hey friend');
  });

  it('creates group chat with user A, B, and C', async () => {
    const res = await request(app)
      .post('/api/v1/chats/group')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: `Weekend Raid Squad ${timestamp}`,
        participantIds: [idB, idC],
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.is_group).toBe(true);
    expect(res.body.data.title).toContain('Weekend Raid Squad');
    expect(res.body.data.participants.length).toBe(3);
    groupChatId = res.body.data.id;
  });

  it('allows group participants to send and read messages', async () => {
    const msgRes = await request(app)
      .post(`/api/v1/chats/${groupChatId}/messages`)
      .set('Authorization', `Bearer ${tokenC}`)
      .send({ content: 'I can play tank role this Saturday!' });

    expect(msgRes.status).toBe(201);
    expect(msgRes.body.data.sender_id).toBe(idC);

    const msgs = await request(app)
      .get(`/api/v1/chats/${groupChatId}/messages`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(msgs.status).toBe(200);
    expect(msgs.body.data.some((m: any) => m.content.includes('I can play tank'))).toBe(true);
  });

  it('prevents non-participants from accessing chat messages', async () => {
    // Create an outsider user
    const outsider = {
      username: `outsider_${timestamp}`,
      email: `outsider_${timestamp}@example.com`,
      password: 'Password123!',
    };
    const outRes = await request(app).post('/api/v1/auth/register').send(outsider);
    const outToken = outRes.body.data.token;
    const outId = outRes.body.data.user.id;

    const res = await request(app)
      .get(`/api/v1/chats/${groupChatId}/messages`)
      .set('Authorization', `Bearer ${outToken}`);

    expect(res.status).toBe(403);

    // Clean up outsider
    await query('DELETE FROM users WHERE id = $1', [outId]);
  });

  it('searches gamers by query and reports accurate friendship status', async () => {
    // User C searches for user A
    const res = await request(app)
      .get(`/api/v1/social/search?q=${userA.username.substring(0, 8)}`)
      .set('Authorization', `Bearer ${tokenC}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data)).toBe(true);

    const foundA = res.body.data.find((u: any) => u.user_id === idA);
    expect(foundA).toBeDefined();
    expect(foundA.username).toBe(userA.username);
    // Not friends yet with C
    expect(foundA.friendship_status).toBe('none');

    // Make sure user C does not appear in their own search
    const foundSelf = res.body.data.find((u: any) => u.user_id === idC);
    expect(foundSelf).toBeUndefined();
  });

  it('reports friendship_status as accepted when searching an existing friend', async () => {
    // User A searches for user B (they are already friends)
    const res = await request(app)
      .get(`/api/v1/social/search?q=${userB.username}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const foundB = res.body.data.find((u: any) => u.user_id === idB);
    expect(foundB).toBeDefined();
    expect(foundB.friendship_status).toBe('accepted');
  });
});
