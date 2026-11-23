import { query } from '../db/index.js';
import type { Friendship } from '../types/chat.js';

export class SocialService {
  static async sendFriendRequest(requesterId: number, addresseeId: number): Promise<Friendship> {
    if (requesterId === addresseeId) {
      throw new Error('Cannot send friend request to yourself');
    }

    const targetUser = await query<{ id: number; username: string; is_banned: boolean }>(
      'SELECT id, username, is_banned FROM users WHERE id = $1',
      [addresseeId]
    );

    if (targetUser.rows.length === 0 || targetUser.rows[0].is_banned) {
      throw new Error('User not found or unavailable');
    }

    // Check if reverse request exists
    const reverse = await query<any>(
      'SELECT * FROM friendships WHERE requester_id = $1 AND addressee_id = $2',
      [addresseeId, requesterId]
    );

    if (reverse.rows.length > 0) {
      const row = reverse.rows[0];
      if (row.status === 'pending') {
        // Auto-accept!
        await query(
          'UPDATE friendships SET status = $1, updated_at = NOW() WHERE id = $2',
          ['accepted', row.id]
        );
        return {
          id: row.id,
          requester_id: addresseeId,
          addressee_id: requesterId,
          status: 'accepted',
          created_at: row.created_at,
          updated_at: new Date().toISOString(),
        };
      }
      if (row.status === 'accepted') {
        return row;
      }
    }

    // Insert or update outgoing request
    const res = await query<any>(
      `INSERT INTO friendships (requester_id, addressee_id, status, created_at, updated_at)
       VALUES ($1, $2, 'pending', NOW(), NOW())
       ON CONFLICT (requester_id, addressee_id) DO UPDATE
       SET status = 'pending', updated_at = NOW()
       RETURNING *`,
      [requesterId, addresseeId]
    );

    return res.rows[0];
  }

  static async respondFriendRequest(
    userId: number,
    requestId: number,
    action: 'accepted' | 'declined'
  ): Promise<Friendship> {
    const check = await query<any>('SELECT * FROM friendships WHERE id = $1', [requestId]);
    if (check.rows.length === 0) {
      throw new Error('Friend request not found');
    }

    const row = check.rows[0];
    if (row.addressee_id !== userId) {
      throw new Error('Not authorized to respond to this friend request');
    }

    const res = await query<any>(
      'UPDATE friendships SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [action, requestId]
    );

    return res.rows[0];
  }

  static async getFriends(userId: number): Promise<any[]> {
    const sql = `
      SELECT
        f.id as friendship_id,
        f.created_at as friendship_date,
        u.id as user_id,
        u.username,
        u.role,
        COALESCE(up.avatar_url, '') as avatar_url,
        COALESCE(up.bio, '') as bio
      FROM friendships f
      JOIN users u ON (
        CASE
          WHEN f.requester_id = $1 THEN u.id = f.addressee_id
          ELSE u.id = f.requester_id
        END
      )
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE (f.requester_id = $1 OR f.addressee_id = $1)
        AND f.status = 'accepted'
        AND u.is_banned = FALSE
      ORDER BY u.username ASC
    `;

    const res = await query<any>(sql, [userId]);
    return res.rows;
  }

  static async getPendingRequests(userId: number): Promise<{ incoming: any[]; outgoing: any[] }> {
    const incomingSql = `
      SELECT
        f.id,
        f.requester_id,
        u.username as requester_username,
        COALESCE(up.avatar_url, '') as avatar_url,
        f.created_at
      FROM friendships f
      JOIN users u ON u.id = f.requester_id
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE f.addressee_id = $1 AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `;

    const outgoingSql = `
      SELECT
        f.id,
        f.addressee_id,
        u.username as addressee_username,
        COALESCE(up.avatar_url, '') as avatar_url,
        f.created_at
      FROM friendships f
      JOIN users u ON u.id = f.addressee_id
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE f.requester_id = $1 AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `;

    const [inRes, outRes] = await Promise.all([
      query<any>(incomingSql, [userId]),
      query<any>(outgoingSql, [userId]),
    ]);

    return {
      incoming: inRes.rows,
      outgoing: outRes.rows,
    };
  }

  static async getFriendshipStatus(
    userId: number,
    otherUserId: number
  ): Promise<'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'declined'> {
    if (userId === otherUserId) {
      return 'none';
    }

    const res = await query<any>(
      `SELECT * FROM friendships
       WHERE (requester_id = $1 AND addressee_id = $2)
          OR (requester_id = $2 AND addressee_id = $1)`,
      [userId, otherUserId]
    );

    if (res.rows.length === 0) {
      return 'none';
    }

    const row = res.rows[0];
    if (row.status === 'accepted') return 'accepted';
    if (row.status === 'declined') return 'declined';
    if (row.requester_id === userId) return 'pending_sent';
    return 'pending_received';
  }
}
