import { query } from '../db/index.js';
import type {
  UserProfileData,
  GameTrack,
  UpdateProfileDto,
  TrackGameDto,
  TrackStatus,
} from '../types/tracker.js';

export class ProfileService {
  static async getProfile(userId: number): Promise<UserProfileData | null> {
    const userRes = await query<{
      id: number;
      username: string;
      role: string;
      created_at: string;
      is_banned: boolean;
    }>(
      `SELECT id, username, role, created_at, is_banned
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      return null;
    }

    const user = userRes.rows[0];

    // Get or create profile
    let profileRes = await query<{
      bio: string;
      avatar_url: string;
      preferred_platforms: string[];
    }>(
      `SELECT bio, avatar_url, preferred_platforms
       FROM user_profiles
       WHERE user_id = $1`,
      [userId]
    );

    if (profileRes.rows.length === 0) {
      await query(
        `INSERT INTO user_profiles (user_id, bio, avatar_url, preferred_platforms)
         VALUES ($1, '', '', '{}')
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );
      profileRes = await query<{
        bio: string;
        avatar_url: string;
        preferred_platforms: string[];
      }>(
        `SELECT bio, avatar_url, preferred_platforms
         FROM user_profiles
         WHERE user_id = $1`,
        [userId]
      );
    }

    const profile = profileRes.rows[0] || {
      bio: '',
      avatar_url: '',
      preferred_platforms: [],
    };

    // Calculate stats
    const statsRes = await query<{
      status: TrackStatus;
      count: string;
      total_hours: string;
    }>(
      `SELECT status, COUNT(*)::text as count, COALESCE(SUM(hours_played), 0)::text as total_hours
       FROM game_tracks
       WHERE user_id = $1
       GROUP BY status`,
      [userId]
    );

    let totalGames = 0;
    let totalHours = 0;
    const gamesByStatus: Record<TrackStatus, number> = {
      want_to_play: 0,
      playing: 0,
      completed: 0,
      dropped: 0,
    };

    for (const row of statsRes.rows) {
      const c = parseInt(row.count, 10);
      const h = parseFloat(row.total_hours);
      totalGames += c;
      totalHours += h;
      if (gamesByStatus[row.status] !== undefined) {
        gamesByStatus[row.status] = c;
      }
    }

    return {
      userId: user.id,
      username: user.username,
      role: user.role,
      bio: profile.bio || '',
      avatar_url: profile.avatar_url || '',
      preferred_platforms: profile.preferred_platforms || [],
      created_at: user.created_at,
      stats: {
        total_games_tracked: totalGames,
        total_hours_played: Number(totalHours.toFixed(1)),
        games_by_status: gamesByStatus,
      },
    };
  }

  static async updateProfile(userId: number, dto: UpdateProfileDto): Promise<UserProfileData> {
    const existing = await this.getProfile(userId);
    if (!existing) {
      throw new Error('User not found');
    }

    const bio = dto.bio !== undefined ? dto.bio.trim() : existing.bio;
    const avatar_url = dto.avatar_url !== undefined ? dto.avatar_url.trim() : existing.avatar_url;
    const preferred_platforms =
      dto.preferred_platforms !== undefined ? dto.preferred_platforms : existing.preferred_platforms;

    await query(
      `INSERT INTO user_profiles (user_id, bio, avatar_url, preferred_platforms, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET bio = EXCLUDED.bio,
           avatar_url = EXCLUDED.avatar_url,
           preferred_platforms = EXCLUDED.preferred_platforms,
           updated_at = NOW()`,
      [userId, bio, avatar_url, preferred_platforms]
    );

    const updated = await this.getProfile(userId);
    return updated!;
  }

  static async getUserLibrary(
    userId: number,
    filters?: { status?: string; search?: string }
  ): Promise<GameTrack[]> {
    let sql = `
      SELECT
        gt.id,
        gt.user_id,
        gt.game_id,
        gt.status,
        gt.hours_played,
        gt.platform,
        gt.personal_score,
        gt.created_at,
        gt.updated_at,
        g.title as game_title,
        g.description as game_description,
        g.platforms as game_platforms,
        g.photos as game_photos,
        COALESCE(ROUND(AVG(r.rating), 1), 0)::float as average_rating
      FROM game_tracks gt
      JOIN games g ON g.id = gt.game_id
      LEFT JOIN reviews r ON r.game_id = g.id
      WHERE gt.user_id = $1
    `;
    const params: any[] = [userId];

    if (filters?.status) {
      params.push(filters.status);
      sql += ` AND gt.status = $${params.length}`;
    }

    if (filters?.search) {
      params.push(`%${filters.search.toLowerCase()}%`);
      sql += ` AND LOWER(g.title) LIKE $${params.length}`;
    }

    sql += `
      GROUP BY gt.id, g.id
      ORDER BY gt.updated_at DESC
    `;

    const res = await query<any>(sql, params);
    return res.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      game_id: row.game_id,
      status: row.status,
      hours_played: parseFloat(row.hours_played) || 0,
      platform: row.platform || '',
      personal_score: row.personal_score !== null ? parseFloat(row.personal_score) : null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      game_title: row.game_title,
      game_description: row.game_description,
      game_platforms: row.game_platforms || [],
      game_photos: row.game_photos || [],
      average_rating: parseFloat(row.average_rating) || 0,
    }));
  }

  static async getGameTrack(userId: number, gameId: number): Promise<GameTrack | null> {
    const res = await query<any>(
      `SELECT
        gt.id,
        gt.user_id,
        gt.game_id,
        gt.status,
        gt.hours_played,
        gt.platform,
        gt.personal_score,
        gt.created_at,
        gt.updated_at,
        g.title as game_title,
        g.platforms as game_platforms,
        g.photos as game_photos
       FROM game_tracks gt
       JOIN games g ON g.id = gt.game_id
       WHERE gt.user_id = $1 AND gt.game_id = $2`,
      [userId, gameId]
    );

    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    return {
      id: row.id,
      user_id: row.user_id,
      game_id: row.game_id,
      status: row.status,
      hours_played: parseFloat(row.hours_played) || 0,
      platform: row.platform || '',
      personal_score: row.personal_score !== null ? parseFloat(row.personal_score) : null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      game_title: row.game_title,
      game_platforms: row.game_platforms || [],
      game_photos: row.game_photos || [],
    };
  }

  static async trackGame(
    userId: number,
    gameId: number,
    dto: TrackGameDto
  ): Promise<GameTrack> {
    // Validate game exists
    const gameCheck = await query('SELECT id FROM games WHERE id = $1', [gameId]);
    if (gameCheck.rows.length === 0) {
      throw new Error('Game not found');
    }

    const validStatuses: TrackStatus[] = ['want_to_play', 'playing', 'completed', 'dropped'];
    if (!validStatuses.includes(dto.status)) {
      throw new Error('Invalid status. Allowed values: want_to_play, playing, completed, dropped');
    }

    const hours = dto.hours_played !== undefined ? Math.max(0, Number(dto.hours_played)) : 0;
    const platform = dto.platform !== undefined ? dto.platform.trim() : '';
    let score: number | null = null;
    if (dto.personal_score !== undefined && dto.personal_score !== null) {
      const s = Number(dto.personal_score);
      if (isNaN(s) || s < 0 || s > 10) {
        throw new Error('Personal score must be a number between 0 and 10');
      }
      score = s;
    }

    const res = await query<any>(
      `INSERT INTO game_tracks (user_id, game_id, status, hours_played, platform, personal_score, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id, game_id) DO UPDATE
       SET status = EXCLUDED.status,
           hours_played = EXCLUDED.hours_played,
           platform = EXCLUDED.platform,
           personal_score = EXCLUDED.personal_score,
           updated_at = NOW()
       RETURNING *`,
      [userId, gameId, dto.status, hours, platform, score]
    );

    const row = res.rows[0];
    return {
      id: row.id,
      user_id: row.user_id,
      game_id: row.game_id,
      status: row.status,
      hours_played: parseFloat(row.hours_played) || 0,
      platform: row.platform || '',
      personal_score: row.personal_score !== null ? parseFloat(row.personal_score) : null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  static async untrackGame(userId: number, gameId: number): Promise<boolean> {
    const res = await query(
      `DELETE FROM game_tracks WHERE user_id = $1 AND game_id = $2`,
      [userId, gameId]
    );
    return (res.rowCount ?? 0) > 0;
  }
}
