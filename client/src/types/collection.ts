import type { Game } from './game';

export interface Collection {
  id: number;
  user_id: number;
  creator_username?: string;
  title: string;
  description: string;
  is_official: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  games_count?: number;
  games?: Game[];
}

export interface CreateCollectionDto {
  title: string;
  description?: string;
  is_official?: boolean;
  is_public?: boolean;
}

export interface UpdateCollectionDto {
  title?: string;
  description?: string;
  is_official?: boolean;
  is_public?: boolean;
}
