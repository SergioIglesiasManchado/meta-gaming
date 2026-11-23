<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { useChatStore } from '../stores/chat';
import { useSocialStore } from '../stores/social';
import { useAuthStore } from '../stores/auth';
import type { ChatConversation } from '../types/chat';

const route = useRoute();
const chatStore = useChatStore();
const socialStore = useSocialStore();
const authStore = useAuthStore();

const activeSidebarTab = ref<'chats' | 'friends'>('chats');
const messageText = ref('');
const isGroupModalOpen = ref('');
const groupTitle = ref('');
const selectedGroupFriendIds = ref<number[]>([]);
const groupError = ref('');
const messagesContainer = ref<HTMLElement | null>(null);

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
};

const selectConversation = async (conv: ChatConversation) => {
  chatStore.currentConversation = conv;
  await chatStore.fetchMessages(conv.id);
  scrollToBottom();
};

const handleStartDirectChat = async (friendUserId: number) => {
  const conv = await chatStore.openDirectChat(friendUserId);
  if (conv) {
    activeSidebarTab.value = 'chats';
    scrollToBottom();
  }
};

const handleSendMessage = async () => {
  if (!chatStore.currentConversation || !messageText.value.trim()) return;
  const text = messageText.value.trim();
  messageText.value = '';
  await chatStore.sendMessage(chatStore.currentConversation.id, text);
  scrollToBottom();
};

const handleCreateGroup = async () => {
  groupError.value = '';
  if (!groupTitle.value.trim()) {
    groupError.value = 'Group title is required';
    return;
  }
  if (selectedGroupFriendIds.value.length === 0) {
    groupError.value = 'Select at least one friend for the group';
    return;
  }

  try {
    const group = await chatStore.createGroupChat(
      groupTitle.value.trim(),
      selectedGroupFriendIds.value
    );
    if (group) {
      isGroupModalOpen.value = '';
      groupTitle.value = '';
      selectedGroupFriendIds.value = [];
      activeSidebarTab.value = 'chats';
      scrollToBottom();
    }
  } catch (err: any) {
    groupError.value = err.message || 'Error creating group chat';
  }
};

const handleAcceptRequest = async (requestId: number) => {
  await socialStore.respondRequest(requestId, 'accepted');
};

const handleDeclineRequest = async (requestId: number) => {
  await socialStore.respondRequest(requestId, 'declined');
};

const formatTime = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

onMounted(async () => {
  await chatStore.fetchConversations();
  await socialStore.fetchFriends();
  await socialStore.fetchPendingRequests();

  // If directed from query params (e.g. ?userId=123)
  const directUserId = route.query.userId;
  if (directUserId) {
    await handleStartDirectChat(parseInt(directUserId as string, 10));
  } else if (chatStore.conversations.length > 0) {
    selectConversation(chatStore.conversations[0]);
  }
});
</script>

<template>
  <div class="chat-layout">
    <!-- Sidebar -->
    <aside class="chat-sidebar">
      <div class="sidebar-header">
        <div class="sidebar-title-row">
          <h2>Messages</h2>
          <button @click="isGroupModalOpen = 'open'" class="btn-new-group" title="New Group Chat">
            + Group
          </button>
        </div>

        <div class="sidebar-tabs">
          <button
            class="tab-btn"
            :class="{ active: activeSidebarTab === 'chats' }"
            @click="activeSidebarTab = 'chats'"
          >
            Chats
            <span v-if="chatStore.totalUnreadCount > 0" class="unread-badge">
              {{ chatStore.totalUnreadCount }}
            </span>
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeSidebarTab === 'friends' }"
            @click="activeSidebarTab = 'friends'"
          >
            Friends ({{ socialStore.friends.length }})
            <span v-if="socialStore.incomingRequests.length > 0" class="pending-badge">
              {{ socialStore.incomingRequests.length }}
            </span>
          </button>
        </div>
      </div>

      <!-- Chats List -->
      <div v-if="activeSidebarTab === 'chats'" class="conv-list">
        <div
          v-for="conv in chatStore.conversations"
          :key="conv.id"
          class="conv-item"
          :class="{ active: chatStore.currentConversation?.id === conv.id }"
          @click="selectConversation(conv)"
        >
          <div class="conv-avatar">
            <span v-if="conv.is_group">👥</span>
            <span v-else>🎮</span>
          </div>

          <div class="conv-info">
            <div class="conv-title-row">
              <span class="conv-title">{{ conv.title }}</span>
              <span v-if="conv.unread_count && conv.unread_count > 0" class="unread-pill">
                {{ conv.unread_count }}
              </span>
            </div>
            <p class="conv-snippet" v-if="conv.last_message">
              <span class="snippet-sender">{{ conv.last_message.sender_username }}:</span>
              {{ conv.last_message.content }}
            </p>
            <p class="conv-snippet empty" v-else>No messages yet</p>
          </div>
        </div>

        <div v-if="chatStore.conversations.length === 0" class="empty-list">
          <p>No conversations yet.</p>
          <button @click="activeSidebarTab = 'friends'" class="btn-link">Message a friend</button>
        </div>
      </div>

      <!-- Friends List -->
      <div v-else class="friends-list">
        <!-- Incoming friend requests -->
        <div v-if="socialStore.incomingRequests.length > 0" class="requests-section">
          <span class="section-title">Friend Requests</span>
          <div
            v-for="req in socialStore.incomingRequests"
            :key="req.id"
            class="request-item"
          >
            <div class="req-user">
              <strong>{{ req.requester_username }}</strong> wants to be friends
            </div>
            <div class="req-actions">
              <button @click="handleAcceptRequest(req.id)" class="btn-accept">Accept</button>
              <button @click="handleDeclineRequest(req.id)" class="btn-decline">Decline</button>
            </div>
          </div>
        </div>

        <!-- Accepted friends -->
        <div class="friends-roster">
          <span class="section-title">My Friends</span>
          <div
            v-for="friend in socialStore.friends"
            :key="friend.user_id"
            class="friend-item"
          >
            <div class="friend-avatar">
              <img v-if="friend.avatar_url" :src="friend.avatar_url" alt="" />
              <div v-else class="avatar-ph">{{ friend.username.substring(0, 2).toUpperCase() }}</div>
            </div>

            <div class="friend-meta">
              <span class="friend-name">{{ friend.username }}</span>
              <span class="friend-role">{{ friend.role }}</span>
            </div>

            <button @click="handleStartDirectChat(friend.user_id)" class="btn-chat-friend">
              💬 Chat
            </button>
          </div>

          <div v-if="socialStore.friends.length === 0" class="empty-list">
            <p>You haven't added any friends yet.</p>
            <router-link to="/games" class="btn-link">Find gamers in communities</router-link>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Chat Window -->
    <main class="chat-main">
      <div v-if="chatStore.currentConversation" class="chat-active">
        <!-- Chat Header -->
        <header class="chat-header">
          <div class="header-info">
            <h3 class="active-title">{{ chatStore.currentConversation.title }}</h3>
            <span v-if="chatStore.currentConversation.is_group" class="group-tag">
              👥 Group ({{ chatStore.currentConversation.participants.length }} members)
            </span>
            <span v-else class="direct-tag">
              💬 Direct 1-on-1 Chat
            </span>
          </div>
        </header>

        <!-- Messages Thread -->
        <div ref="messagesContainer" class="messages-container">
          <div
            v-for="msg in chatStore.messages"
            :key="msg.id"
            class="message-row"
            :class="{ 'mine': msg.sender_id === authStore.user?.id }"
          >
            <div class="msg-bubble">
              <div class="msg-author-row" v-if="msg.sender_id !== authStore.user?.id">
                <span class="author-name">{{ msg.sender_username }}</span>
                <span class="msg-time">{{ formatTime(msg.created_at) }}</span>
              </div>
              <p class="msg-text">{{ msg.content }}</p>
              <div class="msg-time-bottom" v-if="msg.sender_id === authStore.user?.id">
                {{ formatTime(msg.created_at) }}
              </div>
            </div>
          </div>
        </div>

        <!-- Chat Input Bar -->
        <footer class="chat-input-bar">
          <input
            v-model="messageText"
            @keyup.enter="handleSendMessage"
            type="text"
            placeholder="Type a message..."
            class="message-input"
          />
          <button @click="handleSendMessage" class="btn-send">Send</button>
        </footer>
      </div>

      <!-- No Conversation Selected Placeholder -->
      <div v-else class="chat-placeholder">
        <div class="ph-content">
          <span class="ph-icon">🎮</span>
          <h3>MetaGaming Messenger</h3>
          <p>Select a conversation from the sidebar or start a chat with a friend.</p>
        </div>
      </div>
    </main>

    <!-- New Group Modal -->
    <div v-if="isGroupModalOpen" class="modal-backdrop" @click.self="isGroupModalOpen = ''">
      <div class="modal-card">
        <h3>Create Group Chat</h3>
        <p v-if="groupError" class="modal-error">{{ groupError }}</p>

        <div class="form-group">
          <label>Group Title</label>
          <input
            v-model="groupTitle"
            type="text"
            placeholder="e.g. Co-Op Squad"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label>Select Friends to Invite:</label>
          <div v-if="socialStore.friends.length > 0" class="friends-checkbox-list">
            <label
              v-for="friend in socialStore.friends"
              :key="friend.user_id"
              class="friend-checkbox"
            >
              <input
                type="checkbox"
                :value="friend.user_id"
                v-model="selectedGroupFriendIds"
              />
              <span>{{ friend.username }}</span>
            </label>
          </div>
          <p v-else class="empty-notice">Add some friends first to invite them to groups.</p>
        </div>

        <div class="modal-actions">
          <button @click="isGroupModalOpen = ''" class="btn-cancel">Cancel</button>
          <button
            @click="handleCreateGroup"
            class="btn-primary"
            :disabled="socialStore.friends.length === 0"
          >
            Create Group
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-layout {
  display: flex;
  height: calc(100vh - 72px);
  max-width: 1200px;
  margin: 0 auto;
  border: 1px solid var(--border-color, #e5e7eb);
  background: var(--card-bg, #ffffff);
}

.chat-sidebar {
  width: 340px;
  border-right: 1px solid var(--border-color, #e5e7eb);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 1.25rem 1rem 0.5rem 1rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.sidebar-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.sidebar-title-row h2 {
  font-size: 1.4rem;
  font-weight: 800;
  margin: 0;
}

.btn-new-group {
  background: #6366f1;
  color: #fff;
  border: none;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font-size: 0.825rem;
  font-weight: 600;
  cursor: pointer;
}

.sidebar-tabs {
  display: flex;
  gap: 0.5rem;
}

.tab-btn {
  flex: 1;
  background: transparent;
  border: none;
  padding: 0.5rem;
  border-radius: 6px;
  font-weight: 600;
  color: var(--text-muted, #6b7280);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
}

.tab-btn.active {
  background: #eef2ff;
  color: #4f46e5;
}

.unread-badge,
.pending-badge {
  background: #ef4444;
  color: #fff;
  font-size: 0.75rem;
  padding: 0.1rem 0.4rem;
  border-radius: 9999px;
  font-weight: 700;
}

.conv-list,
.friends-list {
  flex: 1;
  overflow-y: auto;
}

.conv-item {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--border-color, #f3f4f6);
  cursor: pointer;
  transition: background 0.15s;
}

.conv-item:hover {
  background: var(--hover-bg, #f9fafb);
}

.conv-item.active {
  background: #f0f4ff;
}

.conv-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #e0e7ff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.35rem;
}

.conv-info {
  flex: 1;
  min-width: 0;
}

.conv-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.2rem;
}

.conv-title {
  font-weight: 700;
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.unread-pill {
  background: #6366f1;
  color: #fff;
  font-size: 0.75rem;
  padding: 0.1rem 0.45rem;
  border-radius: 9999px;
  font-weight: 700;
}

.conv-snippet {
  font-size: 0.825rem;
  color: var(--text-muted, #6b7280);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.snippet-sender {
  font-weight: 600;
}

.section-title {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted, #9ca3af);
  padding: 0.75rem 1rem 0.25rem 1rem;
}

.request-item {
  padding: 0.75rem 1rem;
  background: #fefce8;
  border-bottom: 1px solid #fef08a;
}

.req-user {
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
}

.req-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-accept {
  background: #10b981;
  color: #fff;
  border: none;
  padding: 0.25rem 0.65rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-decline {
  background: #ef4444;
  color: #fff;
  border: none;
  padding: 0.25rem 0.65rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.friend-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color, #f3f4f6);
}

.friend-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  background: #6366f1;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 700;
}

.friend-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.friend-meta {
  flex: 1;
}

.friend-name {
  display: block;
  font-weight: 700;
  font-size: 0.9rem;
}

.friend-role {
  font-size: 0.75rem;
  color: var(--text-muted, #9ca3af);
}

.btn-chat-friend {
  background: transparent;
  border: 1px solid #c7d2fe;
  color: #4f46e5;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-chat-friend:hover {
  background: #eef2ff;
}

/* Chat Main Pane */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.chat-active {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.active-title {
  margin: 0 0 0.25rem 0;
  font-size: 1.25rem;
  font-weight: 800;
}

.group-tag,
.direct-tag {
  font-size: 0.8rem;
  color: var(--text-muted, #6b7280);
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.message-row {
  display: flex;
  justify-content: flex-start;
}

.message-row.mine {
  justify-content: flex-end;
}

.msg-bubble {
  max-width: 65%;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  background: var(--card-inner-bg, #f3f4f6);
  color: var(--text-color, #111827);
}

.message-row.mine .msg-bubble {
  background: #4f46e5;
  color: #ffffff;
}

.msg-author-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.author-name {
  font-size: 0.75rem;
  font-weight: 700;
  color: #4f46e5;
}

.msg-time,
.msg-time-bottom {
  font-size: 0.7rem;
  opacity: 0.7;
}

.msg-time-bottom {
  text-align: right;
  margin-top: 0.25rem;
}

.msg-text {
  margin: 0;
  line-height: 1.4;
  word-break: break-word;
}

.chat-input-bar {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color, #e5e7eb);
  display: flex;
  gap: 0.75rem;
}

.message-input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 8px;
  background: var(--input-bg, #ffffff);
  color: var(--text-color, #111827);
}

.btn-send {
  background: #4f46e5;
  color: #fff;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
}

.chat-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.ph-content {
  max-width: 400px;
  padding: 2rem;
}

.ph-icon {
  font-size: 3.5rem;
}

.empty-list {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--text-muted, #6b7280);
}

.btn-link {
  background: transparent;
  border: none;
  color: #4f46e5;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
}

/* Modal */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-card {
  background: var(--card-bg, #ffffff);
  padding: 2rem;
  border-radius: 14px;
  width: 90%;
  max-width: 480px;
}

.friends-checkbox-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 180px;
  overflow-y: auto;
}

.friend-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 0.35rem;
}

.form-input {
  width: 100%;
  padding: 0.6rem 0.85rem;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 8px;
  box-sizing: border-box;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.btn-cancel {
  background: transparent;
  border: 1px solid var(--border-color, #d1d5db);
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
}

.btn-primary {
  background: #4f46e5;
  color: #fff;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
}
</style>
