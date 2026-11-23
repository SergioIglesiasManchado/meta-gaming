export type TrackStatus = 'want_to_play' | 'playing' | 'completed' | 'dropped';

export interface UserProfileData {
  userId: number;
  username: string;
  role: string;
  bio: string;
  avatar_url: string;
  preferred_platforms: string[];
  created_at: string;
  stats: {
    total_games_tracked: number;
    total_hours_played: number;
    games_by_status: {
      want_to_play: number;
      playing: number;
      completed: number;
      dropped: number;
    };
  };
}

export interface GameTrack {
  id: number;
  user_id: number;
  game_id: number;
  status: TrackStatus;
  hours_played: number;
  platform: string;
  personal_score: number | null;
  created_at: string;
  updated_at: string;
  game_title?: string;
  game_description?: string;
  game_platforms?: string[];
  game_photos?: string[];
  average_rating?: number;
}

export interface UpdateProfileDto {
  bio?: string;
  avatar_url?: string;
  preferred_platforms?: string[];
}

export interface TrackGameDto {
  status: TrackStatus;
  hours_played?: number;
  platform?: string;
  personal_score?: number | null;
}
