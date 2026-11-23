import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ChatConversation, ChatMessage } from '../types/chat';
import { useAuthStore } from './auth';
import { apiBaseUrl, parseJsonResponse } from '../config/api';

export const useChatStore = defineStore('chat', () => {
  const conversations = ref<ChatConversation[]>([]);
  const currentConversation = ref<ChatConversation | null>(null);
  const messages = ref<ChatMessage[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const totalUnreadCount = computed(() => {
    return conversations.value.reduce((sum, c) => sum + (c.unread_count || 0), 0);
  });

  const fetchConversations = async (): Promise<ChatConversation[]> => {
    const authStore = useAuthStore();
    if (!authStore.isAuthenticated) return [];
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/chats`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      });
      const data = await parseJsonResponse(res);
      if (res.ok) {
        conversations.value = data.data;
        return conversations.value;
      }
      return [];
    } catch {
      return [];
    }
  };

  const openDirectChat = async (recipientId: number): Promise<ChatConversation | null> => {
    const authStore = useAuthStore();
    if (!authStore.isAuthenticated) return null;
    loading.value = true;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/chats/direct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
        body: JSON.stringify({ recipientId }),
      });
      const data = await parseJsonResponse(res);
      if (res.ok) {
        currentConversation.value = data.data;
        await fetchMessages(data.data.id);
        await fetchConversations();
        return data.data;
      }
      return null;
    } catch (err: any) {
      error.value = err.message;
      return null;
    } finally {
      loading.value = false;
    }
  };

  const createGroupChat = async (title: string, participantIds: number[]): Promise<ChatConversation | null> => {
    const authStore = useAuthStore();
    if (!authStore.isAuthenticated) return null;
    loading.value = true;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/chats/group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
        body: JSON.stringify({ title, participantIds }),
      });
      const data = await parseJsonResponse(res);
      if (res.ok) {
        currentConversation.value = data.data;
        await fetchMessages(data.data.id);
        await fetchConversations();
        return data.data;
      }
      return null;
    } catch (err: any) {
      error.value = err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const fetchMessages = async (conversationId: number): Promise<ChatMessage[]> => {
    const authStore = useAuthStore();
    if (!authStore.isAuthenticated) return [];
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/chats/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      });
      const data = await parseJsonResponse(res);
      if (res.ok) {
        messages.value = data.data;
        // update local unread count
        const conv = conversations.value.find((c) => c.id === conversationId);
        if (conv) conv.unread_count = 0;
        return messages.value;
      }
      return [];
    } catch {
      return [];
    }
  };

  const sendMessage = async (conversationId: number, content: string): Promise<ChatMessage | null> => {
    const authStore = useAuthStore();
    if (!authStore.isAuthenticated) return null;
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/chats/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
        body: JSON.stringify({ content }),
      });
      const data = await parseJsonResponse(res);
      if (res.ok) {
        messages.value.push(data.data);
        await fetchConversations();
        return data.data;
      }
      return null;
    } catch {
      return null;
    }
  };

  return {
    conversations,
    currentConversation,
    messages,
    loading,
    error,
    totalUnreadCount,
    fetchConversations,
    openDirectChat,
    createGroupChat,
    fetchMessages,
    sendMessage,
  };
});
