import { query } from '../db/index.js';
import type { ChatConversation, ChatMessage, ChatParticipant } from '../types/chat.js';

export class ChatService {
  static async getUserConversations(userId: number): Promise<ChatConversation[]> {
    // 1. Fetch conversations user is part of
    const convSql = `
      SELECT
        c.id,
        c.is_group,
        c.title,
        c.created_by,
        c.created_at,
        c.updated_at,
        cp.last_read_at
      FROM chat_conversations c
      JOIN chat_participants cp ON cp.conversation_id = c.id
      WHERE cp.user_id = $1
      ORDER BY c.updated_at DESC
    `;

    const convRes = await query<any>(convSql, [userId]);
    if (convRes.rows.length === 0) {
      return [];
    }

    const conversations: ChatConversation[] = [];

    for (const row of convRes.rows) {
      // Fetch participants
      const partSql = `
        SELECT
          cp.id,
          cp.conversation_id,
          cp.user_id,
          u.username,
          COALESCE(up.avatar_url, '') as avatar_url,
          cp.joined_at,
          cp.last_read_at
        FROM chat_participants cp
        JOIN users u ON u.id = cp.user_id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE cp.conversation_id = $1
      `;
      const partRes = await query<any>(partSql, [row.id]);

      // Fetch last message
      const lastMsgSql = `
        SELECT
          m.id,
          m.conversation_id,
          m.sender_id,
          u.username as sender_username,
          COALESCE(up.avatar_url, '') as sender_avatar,
          m.content,
          m.created_at
        FROM chat_messages m
        JOIN users u ON u.id = m.sender_id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE m.conversation_id = $1
        ORDER BY m.created_at DESC
        LIMIT 1
      `;
      const lastMsgRes = await query<any>(lastMsgSql, [row.id]);

      // Unread count
      const unreadSql = `
        SELECT COUNT(*)::int as count
        FROM chat_messages
        WHERE conversation_id = $1
          AND created_at > $2
          AND sender_id != $3
      `;
      const unreadRes = await query<{ count: number }>(unreadSql, [
        row.id,
        row.last_read_at,
        userId,
      ]);

      // If direct chat, title is other participant's username
      let displayTitle = row.title;
      if (!row.is_group) {
        const other = partRes.rows.find((p: any) => p.user_id !== userId);
        displayTitle = other ? other.username : 'Direct Chat';
      }

      conversations.push({
        id: row.id,
        is_group: row.is_group,
        title: displayTitle,
        created_by: row.created_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
        participants: partRes.rows,
        last_message: lastMsgRes.rows[0],
        unread_count: unreadRes.rows[0]?.count || 0,
      });
    }

    return conversations;
  }

  static async getOrCreateDirectChat(userId: number, recipientId: number): Promise<ChatConversation> {
    if (userId === recipientId) {
      throw new Error('Cannot start chat with yourself');
    }

    // Check existing direct conversation
    const existingSql = `
      SELECT c.id
      FROM chat_conversations c
      JOIN chat_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
      JOIN chat_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = $2
      WHERE c.is_group = FALSE
      LIMIT 1
    `;
    const existing = await query<any>(existingSql, [userId, recipientId]);

    let convId: number;
    if (existing.rows.length > 0) {
      convId = existing.rows[0].id;
    } else {
      // Create new conversation
      const createRes = await query<any>(
        `INSERT INTO chat_conversations (is_group, title, created_by, created_at, updated_at)
         VALUES (FALSE, '', $1, NOW(), NOW())
         RETURNING id`,
        [userId]
      );
      convId = createRes.rows[0].id;

      // Add participants
      await query(
        `INSERT INTO chat_participants (conversation_id, user_id, joined_at, last_read_at)
         VALUES ($1, $2, NOW(), NOW()), ($1, $3, NOW(), NOW())`,
        [convId, userId, recipientId]
      );
    }

    const conversations = await this.getUserConversations(userId);
    return conversations.find((c) => c.id === convId)!;
  }

  static async createGroupChat(
    userId: number,
    title: string,
    participantIds: number[]
  ): Promise<ChatConversation> {
    if (!title || !title.trim()) {
      throw new Error('Group chat title is required');
    }

    const uniqueIds = Array.from(new Set([userId, ...participantIds]));
    if (uniqueIds.length < 2) {
      throw new Error('Group chat must include at least 2 participants');
    }

    const createRes = await query<any>(
      `INSERT INTO chat_conversations (is_group, title, created_by, created_at, updated_at)
       VALUES (TRUE, $1, $2, NOW(), NOW())
       RETURNING id`,
      [title.trim(), userId]
    );
    const convId = createRes.rows[0].id;

    for (const uid of uniqueIds) {
      await query(
        `INSERT INTO chat_participants (conversation_id, user_id, joined_at, last_read_at)
         VALUES ($1, $2, NOW(), NOW())
         ON CONFLICT (conversation_id, user_id) DO NOTHING`,
        [convId, uid]
      );
    }

    const conversations = await this.getUserConversations(userId);
    return conversations.find((c) => c.id === convId)!;
  }

  static async getConversationMessages(
    conversationId: number,
    userId: number,
    limit: number = 50
  ): Promise<ChatMessage[]> {
    // Verify membership
    const memberCheck = await query(
      'SELECT id FROM chat_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, userId]
    );
    if (memberCheck.rows.length === 0) {
      throw new Error('Not authorized to view messages in this conversation');
    }

    const sql = `
      SELECT
        m.id,
        m.conversation_id,
        m.sender_id,
        u.username as sender_username,
        COALESCE(up.avatar_url, '') as sender_avatar,
        m.content,
        m.created_at
      FROM chat_messages m
      JOIN users u ON u.id = m.sender_id
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
      LIMIT $2
    `;

    const res = await query<any>(sql, [conversationId, limit]);
    // Mark read
    await this.markConversationRead(conversationId, userId);
    return res.rows;
  }

  static async sendMessage(
    conversationId: number,
    senderId: number,
    content: string
  ): Promise<ChatMessage> {
    if (!content || !content.trim()) {
      throw new Error('Message content cannot be empty');
    }

    // Verify membership
    const memberCheck = await query(
      'SELECT id FROM chat_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, senderId]
    );
    if (memberCheck.rows.length === 0) {
      throw new Error('Not a participant in this conversation');
    }

    const res = await query<any>(
      `INSERT INTO chat_messages (conversation_id, sender_id, content, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [conversationId, senderId, content.trim()]
    );

    await query(
      `UPDATE chat_conversations SET updated_at = NOW() WHERE id = $1`,
      [conversationId]
    );

    // Update sender's last_read_at
    await this.markConversationRead(conversationId, senderId);

    const userRes = await query<any>(
      `SELECT u.username, COALESCE(up.avatar_url, '') as avatar_url
       FROM users u
       LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE u.id = $1`,
      [senderId]
    );

    return {
      id: res.rows[0].id,
      conversation_id: res.rows[0].conversation_id,
      sender_id: res.rows[0].sender_id,
      sender_username: userRes.rows[0]?.username || '',
      sender_avatar: userRes.rows[0]?.avatar_url || '',
      content: res.rows[0].content,
      created_at: res.rows[0].created_at,
    };
  }

  static async markConversationRead(conversationId: number, userId: number): Promise<void> {
    await query(
      `UPDATE chat_participants
       SET last_read_at = NOW()
       WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, userId]
    );
  }
}
