import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { UserProfileData, GameTrack, TrackGameDto, UpdateProfileDto } from '../types/tracker';
import { useAuthStore } from './auth';
import { apiBaseUrl, getApiUrl, parseJsonResponse } from '../config/api';

export const useProfileStore = defineStore('profile', () => {
  const profile = ref<UserProfileData | null>(null);
  const library = ref<GameTrack[]>([]);
  const currentTrack = ref<GameTrack | null>(null);
  const loading = ref<boolean>(false);
  const error = ref<string | null>(null);

  const fetchProfile = async (userId: number): Promise<UserProfileData | null> => {
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/users/${userId}/profile`);
      const data = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch user profile');
      }
      profile.value = data.data;
      return profile.value;
    } catch (err: any) {
      error.value = err.message || 'Failed to load profile';
      return null;
    } finally {
      loading.value = false;
    }
  };

  const updateProfile = async (dto: UpdateProfileDto): Promise<UserProfileData | null> => {
    loading.value = true;
    error.value = null;
    const authStore = useAuthStore();
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/users/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
        body: JSON.stringify(dto),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update profile');
      }
      profile.value = data.data;
      return profile.value;
    } catch (err: any) {
      error.value = err.message || 'Failed to update profile';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const fetchLibrary = async (
    userId: number,
    status?: string,
    search?: string
  ): Promise<GameTrack[]> => {
    loading.value = true;
    error.value = null;
    try {
      const url = getApiUrl(`/api/v1/users/${userId}/library`);
      if (status) {
        url.searchParams.set('status', status);
      }
      if (search && search.trim()) {
        url.searchParams.set('search', search.trim());
      }
      const res = await fetch(url.toString());
      const data = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch user library');
      }
      library.value = data.data;
      return library.value;
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch library';
      return [];
    } finally {
      loading.value = false;
    }
  };

  const fetchGameTrack = async (gameId: number): Promise<GameTrack | null> => {
    const authStore = useAuthStore();
    if (!authStore.isAuthenticated) {
      currentTrack.value = null;
      return null;
    }
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/games/${gameId}/track`, {
        headers: {
          Authorization: `Bearer ${authStore.token}`,
        },
      });
      const data = await parseJsonResponse(res);
      if (res.ok && data.status === 'success') {
        currentTrack.value = data.data;
        return currentTrack.value;
      }
      currentTrack.value = null;
      return null;
    } catch {
      currentTrack.value = null;
      return null;
    }
  };

  const trackGame = async (gameId: number, dto: TrackGameDto): Promise<GameTrack | null> => {
    const authStore = useAuthStore();
    if (!authStore.isAuthenticated) {
      throw new Error('Authentication required');
    }
    const res = await fetch(`${apiBaseUrl}/api/v1/games/${gameId}/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify(dto),
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) {
      throw new Error(data.message || 'Failed to track game');
    }
    currentTrack.value = data.data;
    return currentTrack.value;
  };

  const untrackGame = async (gameId: number): Promise<boolean> => {
    const authStore = useAuthStore();
    if (!authStore.isAuthenticated) {
      throw new Error('Authentication required');
    }
    const res = await fetch(`${apiBaseUrl}/api/v1/games/${gameId}/track`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authStore.token}`,
      },
    });
    if (res.ok) {
      currentTrack.value = null;
      return true;
    }
    return false;
  };

  return {
    profile,
    library,
    currentTrack,
    loading,
    error,
    fetchProfile,
    updateProfile,
    fetchLibrary,
    fetchGameTrack,
    trackGame,
    untrackGame,
  };
});
