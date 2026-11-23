import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool, query } from '../src/db/index.js';
import { initDb } from '../src/db/init.js';

describe('User Ban / Unban Security Guards API Battery', () => {
  const app = createApp();
  let adminToken: string;
  let adminId: number;
  let otherAdminToken: string;
  let otherAdminId: number;
  let userToken: string;
  let userId: number;

  beforeAll(async () => {
    await initDb();

    // Authenticate primary admin
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ usernameOrEmail: 'admin', password: 'admin' });
    adminToken = adminLogin.body.data.token;
    adminId = adminLogin.body.data.user.id;

    // Create a second admin
    const a2Name = `admin_two_${Date.now()}`;
    const a2Reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: a2Name, email: `${a2Name}@test.com`, password: 'password123' });
    otherAdminToken = a2Reg.body.data.token;
    otherAdminId = a2Reg.body.data.user.id;
    // Elevate other admin
    await query("UPDATE users SET role = 'admin' WHERE id = $1", [otherAdminId]);

    // Create a regular user
    const uName = `victim_user_${Date.now()}`;
    const uReg = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: uName, email: `${uName}@test.com`, password: 'password123' });
    userToken = uReg.body.data.token;
    userId = uReg.body.data.user.id;
  });

  afterAll(async () => {
    if (otherAdminId) {
      await query('DELETE FROM users WHERE id = $1', [otherAdminId]);
    }
    if (userId) {
      await query('DELETE FROM users WHERE id = $1', [userId]);
    }
    await pool.end();
  });

  it('rejects regular users attempting to ban anyone (403)', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${otherAdminId}/ban`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Admin access required');
  });

  it('prevents an admin from banning their own account (400)', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${adminId}/ban`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('You cannot ban your own account');
  });

  it('prevents an admin from banning another admin (403)', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${otherAdminId}/ban`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Administrators cannot be banned');
  });

  it('allows an admin to successfully ban a regular user', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${userId}/ban`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.data.is_banned).toBe(true);
  });

  it('lists the banned user under the admin /banned endpoint', async () => {
    const res = await request(app)
      .get('/api/v1/users/banned')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const found = res.body.data.find((u: any) => u.id === userId);
    expect(found).toBeDefined();
    expect(found.is_banned).toBe(true);
  });

  it('blocks the banned user from accessing protected endpoints with 403', async () => {
    const res = await request(app)
      .patch('/api/v1/users/profile')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ bio: 'I try to update my bio while banned' });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('This account has been banned by an administrator');
  });

  it('allows an admin to unban the user', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${userId}/unban`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.data.is_banned).toBe(false);
  });

  it('restores access for the unbanned user on protected endpoints', async () => {
    const res = await request(app)
      .patch('/api/v1/users/profile')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ bio: 'I am back and reformed!' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.bio).toBe('I am back and reformed!');
  });
});
