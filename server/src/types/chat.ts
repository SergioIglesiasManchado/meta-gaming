export interface Friendship {
  id: number;
  requester_id: number;
  addressee_id: number;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  updated_at: string;
  friend?: {
    id: number;
    username: string;
    avatar_url?: string;
  };
}

export interface ChatParticipant {
  id: number;
  conversation_id: number;
  user_id: number;
  username: string;
  avatar_url?: string;
  joined_at: string;
  last_read_at: string;
}

export interface ChatMessage {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender_username: string;
  sender_avatar?: string;
  content: string;
  created_at: string;
}

export interface ChatConversation {
  id: number;
  is_group: boolean;
  title: string;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  participants: ChatParticipant[];
  last_message?: ChatMessage;
  unread_count?: number;
}
