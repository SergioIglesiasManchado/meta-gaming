import { query } from '../db/index.js';
import type {
  Collection,
  CollectionGame,
  CreateCollectionDto,
  UpdateCollectionDto,
} from '../types/collection.js';

export class CollectionService {
  static async getCollections(options?: {
    is_official?: boolean;
    user_id?: number;
    current_user_id?: number;
    search?: string;
  }): Promise<Collection[]> {
    let sql = `
      SELECT
        c.id,
        c.user_id,
        u.username as creator_username,
        c.title,
        c.description,
        c.is_official,
        c.is_public,
        c.created_at,
        c.updated_at,
        COUNT(cg.id)::int as games_count
      FROM collections c
      JOIN users u ON u.id = c.user_id
      LEFT JOIN collection_games cg ON cg.collection_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Privacy logic: show public OR owned by current user
    if (options?.current_user_id) {
      params.push(options.current_user_id);
      sql += ` AND (c.is_public = TRUE OR c.user_id = $${params.length})`;
    } else {
      sql += ` AND c.is_public = TRUE`;
    }

    if (options?.is_official !== undefined) {
      params.push(options.is_official);
      sql += ` AND c.is_official = $${params.length}`;
    }

    if (options?.user_id) {
      params.push(options.user_id);
      sql += ` AND c.user_id = $${params.length}`;
    }

    if (options?.search && options.search.trim()) {
      params.push(`%${options.search.trim().toLowerCase()}%`);
      sql += ` AND (LOWER(c.title) LIKE $${params.length} OR LOWER(c.description) LIKE $${params.length})`;
    }

    sql += `
      GROUP BY c.id, u.username
      ORDER BY c.is_official DESC, c.created_at DESC
    `;

    const res = await query<any>(sql, params);
    return res.rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      creator_username: r.creator_username,
      title: r.title,
      description: r.description,
      is_official: r.is_official,
      is_public: r.is_public,
      created_at: r.created_at,
      updated_at: r.updated_at,
      games_count: r.games_count,
    }));
  }

  static async getCollectionById(
    collectionId: number,
    currentUserId?: number
  ): Promise<Collection | null> {
    const res = await query<any>(
      `SELECT
        c.id,
        c.user_id,
        u.username as creator_username,
        c.title,
        c.description,
        c.is_official,
        c.is_public,
        c.created_at,
        c.updated_at
       FROM collections c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = $1`,
      [collectionId]
    );

    if (res.rows.length === 0) {
      return null;
    }

    const col = res.rows[0];

    // Privacy check: private collection only visible to owner
    if (!col.is_public && col.user_id !== currentUserId) {
      return null;
    }

    // Fetch games in collection
    const gamesRes = await query<any>(
      `SELECT
        g.id,
        g.title,
        g.description,
        g.platforms,
        g.photos,
        COALESCE(ROUND(AVG(r.rating), 1), 0)::float as average_rating,
        COUNT(r.id)::int as reviews_count,
        cg.order_index,
        cg.added_at
       FROM collection_games cg
       JOIN games g ON g.id = cg.game_id
       LEFT JOIN reviews r ON r.game_id = g.id
       WHERE cg.collection_id = $1
       GROUP BY g.id, cg.order_index, cg.added_at
       ORDER BY cg.order_index ASC, cg.added_at ASC`,
      [collectionId]
    );

    return {
      id: col.id,
      user_id: col.user_id,
      creator_username: col.creator_username,
      title: col.title,
      description: col.description,
      is_official: col.is_official,
      is_public: col.is_public,
      created_at: col.created_at,
      updated_at: col.updated_at,
      games_count: gamesRes.rows.length,
      games: gamesRes.rows.map((g) => ({
        id: g.id,
        title: g.title,
        description: g.description,
        platforms: g.platforms || [],
        photos: g.photos || [],
        average_rating: parseFloat(g.average_rating) || 0,
        reviews_count: g.reviews_count || 0,
        created_at: g.added_at,
        updated_at: g.added_at,
      })),
    };
  }

  static async createCollection(
    userId: number,
    isAdmin: boolean,
    dto: CreateCollectionDto
  ): Promise<Collection> {
    if (!dto.title || !dto.title.trim()) {
      throw new Error('Collection title is required');
    }

    const title = dto.title.trim();
    const description = dto.description !== undefined ? dto.description.trim() : '';
    const is_public = dto.is_public !== undefined ? Boolean(dto.is_public) : true;
    // Only admin can create official collections
    const is_official = isAdmin && Boolean(dto.is_official);

    const res = await query<any>(
      `INSERT INTO collections (user_id, title, description, is_official, is_public, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [userId, title, description, is_official, is_public]
    );

    const col = res.rows[0];
    const userRes = await query<{ username: string }>('SELECT username FROM users WHERE id = $1', [userId]);

    return {
      id: col.id,
      user_id: col.user_id,
      creator_username: userRes.rows[0]?.username,
      title: col.title,
      description: col.description,
      is_official: col.is_official,
      is_public: col.is_public,
      created_at: col.created_at,
      updated_at: col.updated_at,
      games_count: 0,
      games: [],
    };
  }

  static async updateCollection(
    collectionId: number,
    userId: number,
    isAdmin: boolean,
    dto: UpdateCollectionDto
  ): Promise<Collection> {
    const existing = await query<any>('SELECT * FROM collections WHERE id = $1', [collectionId]);
    if (existing.rows.length === 0) {
      throw new Error('Collection not found');
    }

    const col = existing.rows[0];
    if (col.user_id !== userId && !isAdmin) {
      throw new Error('Not authorized to edit this collection');
    }

    const title = dto.title !== undefined ? dto.title.trim() : col.title;
    if (!title) {
      throw new Error('Collection title cannot be empty');
    }
    const description = dto.description !== undefined ? dto.description.trim() : col.description;
    const is_public = dto.is_public !== undefined ? Boolean(dto.is_public) : col.is_public;
    const is_official = isAdmin && dto.is_official !== undefined ? Boolean(dto.is_official) : col.is_official;

    await query(
      `UPDATE collections
       SET title = $1, description = $2, is_public = $3, is_official = $4, updated_at = NOW()
       WHERE id = $5`,
      [title, description, is_public, is_official, collectionId]
    );

    const updated = await this.getCollectionById(collectionId, userId);
    return updated!;
  }

  static async deleteCollection(
    collectionId: number,
    userId: number,
    isAdmin: boolean
  ): Promise<boolean> {
    const existing = await query<any>('SELECT user_id FROM collections WHERE id = $1', [collectionId]);
    if (existing.rows.length === 0) {
      return false;
    }

    if (existing.rows[0].user_id !== userId && !isAdmin) {
      throw new Error('Not authorized to delete this collection');
    }

    const res = await query('DELETE FROM collections WHERE id = $1', [collectionId]);
    return (res.rowCount ?? 0) > 0;
  }

  static async addGameToCollection(
    collectionId: number,
    gameId: number,
    userId: number,
    isAdmin: boolean
  ): Promise<CollectionGame> {
    const colCheck = await query<any>('SELECT user_id FROM collections WHERE id = $1', [collectionId]);
    if (colCheck.rows.length === 0) {
      throw new Error('Collection not found');
    }

    if (colCheck.rows[0].user_id !== userId && !isAdmin) {
      throw new Error('Not authorized to modify this collection');
    }

    const gameCheck = await query('SELECT id FROM games WHERE id = $1', [gameId]);
    if (gameCheck.rows.length === 0) {
      throw new Error('Game not found');
    }

    const res = await query<any>(
      `INSERT INTO collection_games (collection_id, game_id, added_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (collection_id, game_id) DO NOTHING
       RETURNING *`,
      [collectionId, gameId]
    );

    if (res.rows.length === 0) {
      // Already in collection
      const existing = await query<any>(
        'SELECT * FROM collection_games WHERE collection_id = $1 AND game_id = $2',
        [collectionId, gameId]
      );
      return existing.rows[0];
    }

    return res.rows[0];
  }

  static async removeGameFromCollection(
    collectionId: number,
    gameId: number,
    userId: number,
    isAdmin: boolean
  ): Promise<boolean> {
    const colCheck = await query<any>('SELECT user_id FROM collections WHERE id = $1', [collectionId]);
    if (colCheck.rows.length === 0) {
      throw new Error('Collection not found');
    }

    if (colCheck.rows[0].user_id !== userId && !isAdmin) {
      throw new Error('Not authorized to modify this collection');
    }

    const res = await query(
      'DELETE FROM collection_games WHERE collection_id = $1 AND game_id = $2',
      [collectionId, gameId]
    );

    return (res.rowCount ?? 0) > 0;
  }
}
