import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Friend, FriendRequest } from '../types/chat';
import { useAuthStore } from './auth';
import { apiBaseUrl, parseJsonResponse } from '../config/api';

export const useSocialStore = defineStore('social', () => {
  const friends = ref<Friend[]>([]);
  const incomingRequests = ref<FriendRequest[]>([]);
  const outgoingRequests = ref<FriendRequest[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchFriends = async (): Promise<Friend[]> => {
    const authStore = useAuthStore();
    if (!authStore.isAuthenticated) return [];
    loading.value = true;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/social/friends`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      });
      const data = await parseJsonResponse(res);
      if (res.ok) {
        friends.value = data.data;
        return friends.value;
      }
      return [];
    } catch {
      return [];
    } finally {
      loading.value = false;
    }
  };

  const fetchPendingRequests = async (): Promise<void> => {
    const authStore = useAuthStore();
    if (!authStore.isAuthenticated) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/social/requests`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      });
      const data = await parseJsonResponse(res);
      if (res.ok) {
        incomingRequests.value = data.data.incoming;
        outgoingRequests.value = data.data.outgoing;
      }
    } catch {
      // Ignore
    }
  };

  const sendFriendRequest = async (targetUserId: number): Promise<void> => {
    const authStore = useAuthStore();
    const res = await fetch(`${apiBaseUrl}/api/v1/social/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({ targetUserId }),
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) {
      throw new Error(data.message || 'Error sending friend request');
    }
    await fetchPendingRequests();
  };

  const respondRequest = async (requestId: number, action: 'accepted' | 'declined'): Promise<void> => {
    const authStore = useAuthStore();
    const res = await fetch(`${apiBaseUrl}/api/v1/social/requests/${requestId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({ action }),
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) {
      throw new Error(data.message || 'Error responding to request');
    }
    await fetchPendingRequests();
    await fetchFriends();
  };

  const getFriendshipStatus = async (
    targetUserId: number
  ): Promise<'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'declined'> => {
    const authStore = useAuthStore();
    if (!authStore.isAuthenticated) return 'none';
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/social/status/${targetUserId}`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      });
      const data = await parseJsonResponse(res);
      if (res.ok) {
        return data.data.status;
      }
      return 'none';
    } catch {
      return 'none';
    }
  };

  return {
    friends,
    incomingRequests,
    outgoingRequests,
    loading,
    error,
    fetchFriends,
    fetchPendingRequests,
    sendFriendRequest,
    respondRequest,
    getFriendshipStatus,
  };
});
