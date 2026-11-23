<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useProfileStore } from '../stores/profile';
import { useSocialStore } from '../stores/social';
import type { TrackStatus } from '../types/tracker';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const profileStore = useProfileStore();
const socialStore = useSocialStore();

const activeStatusFilter = ref<string>('all');
const searchQuery = ref<string>('');
const isEditingBio = ref<boolean>(false);
const editBio = ref<string>('');
const editAvatar = ref<string>('');
const editPlatforms = ref<string>('');
const saveMessage = ref<string>('');

const friendshipStatus = ref<'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'declined'>('none');
const isFriendActionLoading = ref(false);

const currentUserId = computed(() => {
  if (route.params.id) {
    return parseInt(route.params.id as string, 10);
  }
  return authStore.user?.id || 0;
});

const isOwnProfile = computed(() => {
  return authStore.user?.id === currentUserId.value;
});

const loadFriendshipStatus = async () => {
  if (authStore.isAuthenticated && !isOwnProfile.value && currentUserId.value) {
    friendshipStatus.value = await socialStore.getFriendshipStatus(currentUserId.value);
  }
};

const loadProfileData = async () => {
  if (!currentUserId.value) return;
  const p = await profileStore.fetchProfile(currentUserId.value);
  if (p) {
    editBio.value = p.bio;
    editAvatar.value = p.avatar_url;
    editPlatforms.value = p.preferred_platforms.join(', ');
  }
  await loadLibrary();
  await loadFriendshipStatus();
};

const handleAddFriend = async () => {
  if (!authStore.isAuthenticated) {
    router.push('/login');
    return;
  }
  isFriendActionLoading.value = true;
  try {
    await socialStore.sendFriendRequest(currentUserId.value);
    await loadFriendshipStatus();
  } finally {
    isFriendActionLoading.value = false;
  }
};

const handleStartChatWithUser = () => {
  router.push(`/chat?userId=${currentUserId.value}`);
};

const loadLibrary = async () => {
  if (!currentUserId.value) return;
  const statusParam = activeStatusFilter.value === 'all' ? undefined : activeStatusFilter.value;
  await profileStore.fetchLibrary(currentUserId.value, statusParam, searchQuery.value);
};

onMounted(() => {
  loadProfileData();
});

watch(() => route.params.id, () => {
  loadProfileData();
});

const setStatusFilter = (status: string) => {
  activeStatusFilter.value = status;
  loadLibrary();
};

const onSearch = () => {
  loadLibrary();
};

const handleSaveProfile = async () => {
  try {
    saveMessage.value = '';
    const platforms = editPlatforms.value
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    await profileStore.updateProfile({
      bio: editBio.value,
      avatar_url: editAvatar.value,
      preferred_platforms: platforms,
    });

    isEditingBio.value = false;
    saveMessage.value = 'Profile updated successfully!';
    setTimeout(() => {
      saveMessage.value = '';
    }, 3000);
  } catch (err: any) {
    saveMessage.value = err.message || 'Failed to update profile';
  }
};

const getStatusBadgeClass = (status: TrackStatus) => {
  switch (status) {
    case 'playing':
      return 'badge-playing';
    case 'completed':
      return 'badge-completed';
    case 'want_to_play':
      return 'badge-want';
    case 'dropped':
      return 'badge-dropped';
    default:
      return '';
  }
};

const formatStatus = (status: TrackStatus) => {
  switch (status) {
    case 'playing':
      return 'Playing';
    case 'completed':
      return 'Completed';
    case 'want_to_play':
      return 'Want to Play';
    case 'dropped':
      return 'Dropped';
  }
};
</script>

<template>
  <div class="profile-container">
    <div v-if="profileStore.loading && !profileStore.profile" class="loading-state">
      <div class="spinner"></div>
      <p>Loading gamer profile...</p>
    </div>

    <div v-else-if="profileStore.profile" class="profile-content">
      <!-- Profile Header Banner -->
      <section class="profile-header-card">
        <div class="profile-header-main">
          <div class="avatar-wrapper">
            <img
              v-if="profileStore.profile.avatar_url"
              :src="profileStore.profile.avatar_url"
              alt="Avatar"
              class="profile-avatar"
            />
            <div v-else class="avatar-placeholder">
              {{ profileStore.profile.username.substring(0, 2).toUpperCase() }}
            </div>
          </div>

          <div class="profile-info">
            <div class="name-role-row">
              <h1 class="username">{{ profileStore.profile.username }}</h1>
              <span class="role-pill" :class="profileStore.profile.role">
                {{ profileStore.profile.role }}
              </span>
            </div>
            <p class="joined-date">
              Member since {{ new Date(profileStore.profile.created_at).toLocaleDateString() }}
            </p>

            <div v-if="profileStore.profile.preferred_platforms.length" class="platforms-list">
              <span
                v-for="platform in profileStore.profile.preferred_platforms"
                :key="platform"
                class="platform-pill"
              >
                🎮 {{ platform }}
              </span>
            </div>

            <p class="bio-text" v-if="profileStore.profile.bio">
              {{ profileStore.profile.bio }}
            </p>
            <p class="bio-placeholder" v-else>
              <em>No bio provided yet.</em>
            </p>

            <div v-if="isOwnProfile" class="header-actions">
              <button
                @click="isEditingBio = !isEditingBio"
                class="btn-edit-profile"
              >
                {{ isEditingBio ? 'Cancel Editing' : 'Edit Profile' }}
              </button>
            </div>
            <div v-else-if="authStore.isAuthenticated" class="header-actions">
              <button
                v-if="friendshipStatus === 'none'"
                @click="handleAddFriend"
                class="btn-primary"
                :disabled="isFriendActionLoading"
              >
                + Add Friend
              </button>
              <span v-else-if="friendshipStatus === 'pending_sent'" class="status-pill pending">
                Friend Request Sent
              </span>
              <button
                v-else-if="friendshipStatus === 'pending_received'"
                @click="handleAddFriend"
                class="btn-primary"
              >
                Accept Friend Request
              </button>
              <span v-else-if="friendshipStatus === 'accepted'" class="status-pill friends">
                ✓ Friends
              </span>

              <button @click="handleStartChatWithUser" class="btn-chat-action">
                💬 Message
              </button>
            </div>
          </div>
        </div>

        <!-- Edit Profile Form (conditional) -->
        <div v-if="isEditingBio && isOwnProfile" class="edit-profile-card">
          <h3>Edit Profile Details</h3>
          <div class="form-group">
            <label>Avatar Image URL</label>
            <input
              v-model="editAvatar"
              type="url"
              placeholder="https://example.com/avatar.jpg"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label>Bio / About Me</label>
            <textarea
              v-model="editBio"
              rows="3"
              placeholder="Tell other gamers about your favorite games, genres, or gaming history..."
              class="form-textarea"
            ></textarea>
          </div>
          <div class="form-group">
            <label>Preferred Platforms (comma separated)</label>
            <input
              v-model="editPlatforms"
              type="text"
              placeholder="PC, PS5, Nintendo Switch, Xbox Series X"
              class="form-input"
            />
          </div>
          <div class="edit-actions">
            <button @click="handleSaveProfile" class="btn-primary" :disabled="profileStore.loading">
              Save Changes
            </button>
          </div>
          <p v-if="saveMessage" class="feedback-msg">{{ saveMessage }}</p>
        </div>
      </section>

      <!-- Gamer Stats Section -->
      <section class="stats-grid">
        <div class="stat-card">
          <span class="stat-num">{{ profileStore.profile.stats.total_games_tracked }}</span>
          <span class="stat-label">Tracked Games</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">{{ profileStore.profile.stats.total_hours_played }}h</span>
          <span class="stat-label">Total Playtime</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">{{ profileStore.profile.stats.games_by_status.completed }}</span>
          <span class="stat-label">Completed</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">{{ profileStore.profile.stats.games_by_status.playing }}</span>
          <span class="stat-label">Currently Playing</span>
        </div>
      </section>

      <!-- Library Section -->
      <section class="library-section">
        <div class="library-header">
          <h2>Game Library</h2>
          <div class="search-box">
            <input
              v-model="searchQuery"
              @keyup.enter="onSearch"
              type="text"
              placeholder="Filter by title..."
              class="library-search-input"
            />
            <button @click="onSearch" class="btn-search">Search</button>
          </div>
        </div>

        <!-- Filter tabs -->
        <div class="status-tabs">
          <button
            class="tab-btn"
            :class="{ active: activeStatusFilter === 'all' }"
            @click="setStatusFilter('all')"
          >
            All ({{ profileStore.profile.stats.total_games_tracked }})
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeStatusFilter === 'playing' }"
            @click="setStatusFilter('playing')"
          >
            Playing ({{ profileStore.profile.stats.games_by_status.playing }})
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeStatusFilter === 'completed' }"
            @click="setStatusFilter('completed')"
          >
            Completed ({{ profileStore.profile.stats.games_by_status.completed }})
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeStatusFilter === 'want_to_play' }"
            @click="setStatusFilter('want_to_play')"
          >
            Want to Play ({{ profileStore.profile.stats.games_by_status.want_to_play }})
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeStatusFilter === 'dropped' }"
            @click="setStatusFilter('dropped')"
          >
            Dropped ({{ profileStore.profile.stats.games_by_status.dropped }})
          </button>
        </div>

        <!-- Library Grid -->
        <div v-if="profileStore.library.length > 0" class="library-grid">
          <div
            v-for="item in profileStore.library"
            :key="item.id"
            class="library-card"
          >
            <div class="card-cover-wrapper">
              <img
                v-if="item.game_photos && item.game_photos.length"
                :src="item.game_photos[0]"
                :alt="item.game_title"
                class="game-cover-img"
              />
              <div v-else class="game-cover-placeholder">🎮</div>
              <span class="status-badge" :class="getStatusBadgeClass(item.status)">
                {{ formatStatus(item.status) }}
              </span>
            </div>

            <div class="card-body">
              <router-link :to="`/games/${item.game_id}`" class="game-card-title">
                {{ item.game_title }}
              </router-link>

              <div class="tracking-metrics">
                <span class="metric-item">
                  ⏱️ <strong>{{ item.hours_played }}</strong> hrs
                </span>
                <span v-if="item.platform" class="metric-item">
                  🎮 {{ item.platform }}
                </span>
                <span v-if="item.personal_score !== null" class="metric-item score">
                  ⭐ {{ item.personal_score }}/10
                </span>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-library">
          <p>No tracked games found in this category.</p>
          <router-link to="/games" class="btn-primary">Browse Games to Track</router-link>
        </div>
      </section>
    </div>

    <div v-else class="empty-state">
      <p>User profile not found.</p>
      <router-link to="/games" class="btn-primary">Back to Games</router-link>
    </div>
  </div>
</template>

<style scoped>
.profile-container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.profile-header-card {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 16px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.profile-header-main {
  display: flex;
  gap: 2rem;
  align-items: flex-start;
}

.avatar-wrapper {
  flex-shrink: 0;
}

.profile-avatar {
  width: 110px;
  height: 110px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid #6366f1;
}

.avatar-placeholder {
  width: 110px;
  height: 110px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #a855f7);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.25rem;
  font-weight: 700;
}

.profile-info {
  flex: 1;
}

.name-role-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.35rem;
}

.username {
  font-size: 2rem;
  font-weight: 800;
  margin: 0;
}

.role-pill {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
}

.role-pill.admin {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.role-pill.user {
  background: #eef2ff;
  color: #4f46e5;
  border: 1px solid #c7d2fe;
}

.joined-date {
  color: var(--text-muted, #6b7280);
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
}

.platforms-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.platform-pill {
  background: var(--chip-bg, #f3f4f6);
  color: var(--text-color, #1f2937);
  padding: 0.25rem 0.65rem;
  border-radius: 8px;
  font-size: 0.825rem;
  font-weight: 500;
}

.bio-text {
  font-size: 1rem;
  line-height: 1.5;
  color: var(--text-color, #374151);
  margin-bottom: 1rem;
}

.bio-placeholder {
  color: var(--text-muted, #9ca3af);
  margin-bottom: 1rem;
}

.btn-edit-profile {
  background: transparent;
  border: 1px solid var(--border-color, #d1d5db);
  padding: 0.45rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  color: var(--text-color, #374151);
  transition: all 0.2s;
}

.btn-edit-profile:hover {
  background: var(--hover-bg, #f3f4f6);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.btn-chat-action {
  background: transparent;
  border: 1px solid #6366f1;
  color: #6366f1;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

.btn-chat-action:hover {
  background: #eef2ff;
}

.status-pill {
  padding: 0.4rem 0.85rem;
  border-radius: 9999px;
  font-size: 0.85rem;
  font-weight: 600;
}

.status-pill.pending {
  background: #fef3c7;
  color: #b45309;
}

.status-pill.friends {
  background: #dcfce7;
  color: #15803d;
}

.edit-profile-card {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-color, #e5e7eb);
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.35rem;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 0.6rem 0.85rem;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 8px;
  background: var(--input-bg, #ffffff);
  color: var(--text-color, #111827);
  box-sizing: border-box;
}

.btn-primary {
  background: #4f46e5;
  color: #ffffff;
  padding: 0.6rem 1.25rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
}

.btn-primary:hover {
  background: #4338ca;
}

.feedback-msg {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #16a34a;
}

/* Stats grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.25rem;
  margin-bottom: 2.5rem;
}

.stat-card {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 12px;
  padding: 1.25rem;
  text-align: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
}

.stat-num {
  display: block;
  font-size: 2rem;
  font-weight: 800;
  color: #4f46e5;
}

.stat-label {
  color: var(--text-muted, #6b7280);
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
}

/* Library Section */
.library-section {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 16px;
  padding: 2rem;
}

.library-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.search-box {
  display: flex;
  gap: 0.5rem;
}

.library-search-input {
  padding: 0.5rem 0.85rem;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 8px;
  background: var(--input-bg, #ffffff);
  color: var(--text-color, #111827);
}

.btn-search {
  padding: 0.5rem 1rem;
  background: #4f46e5;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.status-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.75rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  padding-bottom: 0.75rem;
}

.tab-btn {
  background: transparent;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 600;
  color: var(--text-muted, #6b7280);
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn.active {
  background: #eef2ff;
  color: #4f46e5;
}

.library-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.5rem;
}

.library-card {
  background: var(--card-inner-bg, #fafafa);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s, box-shadow 0.2s;
}

.library-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
}

.card-cover-wrapper {
  position: relative;
  height: 140px;
  background: #e2e8f0;
}

.game-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.game-cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
}

.status-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.badge-playing {
  background: #3b82f6;
  color: #fff;
}

.badge-completed {
  background: #10b981;
  color: #fff;
}

.badge-want {
  background: #f59e0b;
  color: #fff;
}

.badge-dropped {
  background: #6b7280;
  color: #fff;
}

.card-body {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.game-card-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-color, #111827);
  text-decoration: none;
  margin-bottom: 0.65rem;
}

.game-card-title:hover {
  color: #4f46e5;
}

.tracking-metrics {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
  color: var(--text-muted, #4b5563);
  margin-top: auto;
}

.metric-item.score {
  font-weight: 700;
  color: #f59e0b;
}

.empty-library {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-muted, #6b7280);
}

.empty-library p {
  margin-bottom: 1rem;
}

@media (max-width: 640px) {
  .profile-container {
    padding: 1rem 0.75rem;
  }
  .profile-header-card {
    padding: 1.25rem;
  }
  .profile-header-main {
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 1.25rem;
  }
  .name-role-row {
    justify-content: center;
    flex-wrap: wrap;
  }
  .platforms-list {
    justify-content: center;
  }
  .header-actions {
    justify-content: center;
    flex-wrap: wrap;
  }
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }
  .library-header {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
  .search-box {
    display: flex;
    width: 100%;
  }
  .library-search-input {
    flex: 1;
    width: auto;
  }
  .status-tabs {
    overflow-x: auto;
    padding-bottom: 0.5rem;
    white-space: nowrap;
    display: flex;
  }
  .tab-btn {
    flex-shrink: 0;
  }
  .games-grid {
    grid-template-columns: 1fr;
  }
}
</style>
