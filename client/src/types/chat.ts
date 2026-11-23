export interface Friend {
  friendship_id: number;
  friendship_date: string;
  user_id: number;
  username: string;
  role: string;
  avatar_url?: string;
  bio?: string;
}

export interface SearchedGamer {
  user_id: number;
  username: string;
  role: string;
  avatar_url?: string;
  bio?: string;
  friendship_status: 'none' | 'pending_sent' | 'pending_received' | 'accepted';
}

export interface FriendRequest {
  id: number;
  requester_id?: number;
  requester_username?: string;
  addressee_id?: number;
  addressee_username?: string;
  avatar_url?: string;
  created_at: string;
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
