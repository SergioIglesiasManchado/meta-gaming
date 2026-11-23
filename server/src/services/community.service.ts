import { query } from '../db/index.js';
import {
  Community,
  CommunityComment,
  CommunityPost,
  CreateCommentDto,
  CreatePostDto
} from '../types/community.js';

export class CommunityService {
  public static async getCommunityByGameId(gameId: number): Promise<Community> {
    const communityQuery = `
      SELECT 
        c.id,
        c.game_id,
        c.name,
        c.description,
        c.created_at,
        c.updated_at,
        g.title AS game_title,
        g.photos AS game_photos
      FROM communities c
      JOIN games g ON c.game_id = g.id
      WHERE c.game_id = $1
    `;

    const result = await query(communityQuery, [gameId]);
    if (result.rows.length > 0) {
      return result.rows[0];
    }

    // If community does not exist yet, check if game exists and auto-create
    const gameResult = await query('SELECT id, title, description, photos FROM games WHERE id = $1', [gameId]);
    if (gameResult.rows.length === 0) {
      const error = new Error('Game not found');
      (error as any).statusCode = 404;
      throw error;
    }

    const game = gameResult.rows[0];
    const insertResult = await query(
      `INSERT INTO communities (game_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING id, game_id, name, description, created_at, updated_at`,
      [game.id, game.title, game.description]
    );

    return {
      ...insertResult.rows[0],
      game_title: game.title,
      game_photos: game.photos
    };
  }

  public static async getCommunityById(communityId: number): Promise<Community> {
    const communityQuery = `
      SELECT 
        c.id,
        c.game_id,
        c.name,
        c.description,
        c.created_at,
        c.updated_at,
        g.title AS game_title,
        g.photos AS game_photos
      FROM communities c
      JOIN games g ON c.game_id = g.id
      WHERE c.id = $1
    `;

    const result = await query(communityQuery, [communityId]);
    if (result.rows.length === 0) {
      const error = new Error('Community not found');
      (error as any).statusCode = 404;
      throw error;
    }

    return result.rows[0];
  }

  public static async getCommunityPosts(
    communityId: number,
    options?: { type?: string; sort?: 'newest' | 'upvotes' },
    currentUserId?: number
  ): Promise<CommunityPost[]> {
    // Verify community exists
    await this.getCommunityById(communityId);

    let sql = `
      SELECT 
        p.id,
        p.community_id,
        p.user_id,
        u.username,
        p.title,
        p.content,
        p.post_type,
        p.media_url,
        p.created_at,
        p.updated_at,
        COUNT(DISTINCT c.id)::int AS comments_count,
        COUNT(DISTINCT pr.id)::int AS upvotes_count,
        COALESCE(BOOL_OR(pr.user_id = $2), FALSE) AS has_upvoted
      FROM community_posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN community_comments c ON c.post_id = p.id
      LEFT JOIN post_reactions pr ON pr.post_id = p.id
      WHERE p.community_id = $1
    `;
    const params: any[] = [communityId, currentUserId || 0];

    if (options?.type && options.type !== 'all') {
      params.push(options.type);
      sql += ` AND p.post_type = $${params.length}`;
    }

    sql += ` GROUP BY p.id, u.username`;

    if (options?.sort === 'upvotes') {
      sql += ` ORDER BY upvotes_count DESC, p.created_at DESC`;
    } else {
      sql += ` ORDER BY p.created_at DESC`;
    }

    const result = await query(sql, params);
    return result.rows;
  }

  public static async createPost(
    communityId: number,
    userId: number,
    dto: CreatePostDto
  ): Promise<CommunityPost> {
    await this.getCommunityById(communityId);

    const { title, content } = dto;
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      const error = new Error('Question title is required');
      (error as any).statusCode = 400;
      throw error;
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      const error = new Error('Question content is required');
      (error as any).statusCode = 400;
      throw error;
    }

    const post_type =
      dto.post_type && ['question', 'discussion', 'guide', 'screenshot'].includes(dto.post_type)
        ? dto.post_type
        : 'question';
    const media_url = dto.media_url ? dto.media_url.trim() : '';

    const insertSql = `
      INSERT INTO community_posts (community_id, user_id, title, content, post_type, media_url)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, community_id, user_id, title, content, post_type, media_url, created_at, updated_at
    `;

    const insertResult = await query(insertSql, [
      communityId,
      userId,
      title.trim(),
      content.trim(),
      post_type,
      media_url,
    ]);

    const userResult = await query('SELECT username FROM users WHERE id = $1', [userId]);
    const username = userResult.rows[0]?.username || 'Unknown';

    return {
      ...insertResult.rows[0],
      username,
      comments_count: 0,
      upvotes_count: 0,
      has_upvoted: false,
    };
  }

  public static async toggleReaction(
    postId: number,
    userId: number
  ): Promise<{ upvoted: boolean; upvotes_count: number }> {
    const postCheck = await query('SELECT id FROM community_posts WHERE id = $1', [postId]);
    if (postCheck.rows.length === 0) {
      const error = new Error('Post not found');
      (error as any).statusCode = 404;
      throw error;
    }

    const existing = await query(
      'SELECT id FROM post_reactions WHERE post_id = $1 AND user_id = $2',
      [postId, userId]
    );

    let upvoted: boolean;
    if (existing.rows.length > 0) {
      await query('DELETE FROM post_reactions WHERE post_id = $1 AND user_id = $2', [postId, userId]);
      upvoted = false;
    } else {
      await query(
        'INSERT INTO post_reactions (post_id, user_id, reaction_type) VALUES ($1, $2, $3)',
        [postId, userId, 'upvote']
      );
      upvoted = true;
    }

    const countRes = await query<{ count: string }>(
      'SELECT COUNT(*)::text as count FROM post_reactions WHERE post_id = $1',
      [postId]
    );
    const upvotes_count = parseInt(countRes.rows[0]?.count || '0', 10);

    return { upvoted, upvotes_count };
  }

  public static async getPostWithComments(
    postId: number,
    currentUserId?: number
  ): Promise<{ post: CommunityPost; comments: CommunityComment[] }> {
    const postSql = `
      SELECT 
        p.id,
        p.community_id,
        p.user_id,
        u.username,
        p.title,
        p.content,
        p.post_type,
        p.media_url,
        p.created_at,
        p.updated_at,
        COUNT(DISTINCT c.id)::int AS comments_count,
        COUNT(DISTINCT pr.id)::int AS upvotes_count,
        COALESCE(BOOL_OR(pr.user_id = $2), FALSE) AS has_upvoted
      FROM community_posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN community_comments c ON c.post_id = p.id
      LEFT JOIN post_reactions pr ON pr.post_id = p.id
      WHERE p.id = $1
      GROUP BY p.id, u.username
    `;

    const postResult = await query(postSql, [postId, currentUserId || 0]);
    if (postResult.rows.length === 0) {
      const error = new Error('Post not found');
      (error as any).statusCode = 404;
      throw error;
    }

    const commentsSql = `
      SELECT 
        c.id,
        c.post_id,
        c.user_id,
        u.username,
        c.parent_comment_id,
        c.content,
        c.created_at,
        c.updated_at
      FROM community_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = $1
      ORDER BY c.created_at ASC
    `;

    const commentsResult = await query(commentsSql, [postId]);
    const flatComments: CommunityComment[] = commentsResult.rows.map((row) => ({
      ...row,
      replies: []
    }));

    // Build threaded hierarchy
    const commentMap = new Map<number, CommunityComment>();
    flatComments.forEach((c) => commentMap.set(c.id, c));

    const topLevelComments: CommunityComment[] = [];

    flatComments.forEach((c) => {
      if (c.parent_comment_id && commentMap.has(c.parent_comment_id)) {
        const parent = commentMap.get(c.parent_comment_id)!;
        if (!parent.replies) {
          parent.replies = [];
        }
        parent.replies.push(c);
      } else {
        topLevelComments.push(c);
      }
    });

    return {
      post: postResult.rows[0],
      comments: topLevelComments
    };
  }

  public static async createComment(
    postId: number,
    userId: number,
    dto: CreateCommentDto
  ): Promise<CommunityComment> {
    const { content, parent_comment_id = null } = dto;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      const error = new Error('Comment content cannot be empty');
      (error as any).statusCode = 400;
      throw error;
    }

    // Verify post exists
    const postCheck = await query('SELECT id FROM community_posts WHERE id = $1', [postId]);
    if (postCheck.rows.length === 0) {
      const error = new Error('Post not found');
      (error as any).statusCode = 404;
      throw error;
    }

    // If parent_comment_id is provided, verify it exists and belongs to the same post
    if (parent_comment_id !== null && parent_comment_id !== undefined) {
      const parentCheck = await query(
        'SELECT id FROM community_comments WHERE id = $1 AND post_id = $2',
        [parent_comment_id, postId]
      );
      if (parentCheck.rows.length === 0) {
        const error = new Error('Parent comment not found for this post');
        (error as any).statusCode = 404;
        throw error;
      }
    }

    const insertSql = `
      INSERT INTO community_comments (post_id, user_id, parent_comment_id, content)
      VALUES ($1, $2, $3, $4)
      RETURNING id, post_id, user_id, parent_comment_id, content, created_at, updated_at
    `;

    const insertResult = await query(insertSql, [
      postId,
      userId,
      parent_comment_id,
      content.trim()
    ]);

    const userResult = await query('SELECT username FROM users WHERE id = $1', [userId]);
    const username = userResult.rows[0]?.username || 'Unknown';

    return {
      ...insertResult.rows[0],
      username,
      replies: []
    };
  }
}
