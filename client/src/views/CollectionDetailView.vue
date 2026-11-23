<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCollectionStore } from '../stores/collection';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const collectionStore = useCollectionStore();
const authStore = useAuthStore();

const collectionId = computed(() => parseInt(route.params.id as string, 10));

const isEditing = ref(false);
const editTitle = ref('');
const editDescription = ref('');
const editIsPublic = ref(true);
const editError = ref('');
const isDeleting = ref(false);

const isOwner = computed(() => {
  if (!collectionStore.currentCollection || !authStore.user) return false;
  return collectionStore.currentCollection.user_id === authStore.user.id;
});

const canManage = computed(() => {
  return isOwner.value || authStore.isAdmin;
});

const loadCollection = async () => {
  if (isNaN(collectionId.value)) {
    router.push('/collections');
    return;
  }
  const col = await collectionStore.fetchCollectionById(collectionId.value);
  if (col) {
    editTitle.value = col.title;
    editDescription.value = col.description;
    editIsPublic.value = col.is_public;
  }
};

onMounted(() => {
  loadCollection();
});

const handleUpdate = async () => {
  editError.value = '';
  if (!editTitle.value.trim()) {
    editError.value = 'Title cannot be empty';
    return;
  }

  try {
    await collectionStore.updateCollection(collectionId.value, {
      title: editTitle.value.trim(),
      description: editDescription.value.trim(),
      is_public: editIsPublic.value,
    });
    isEditing.value = false;
  } catch (err: any) {
    editError.value = err.message || 'Error updating collection';
  }
};

const handleDelete = async () => {
  if (!confirm('Are you sure you want to delete this collection?')) return;
  isDeleting.value = true;
  try {
    await collectionStore.deleteCollection(collectionId.value);
    router.push('/collections');
  } catch (err: any) {
    alert(err.message || 'Failed to delete collection');
  } finally {
    isDeleting.value = false;
  }
};

const handleRemoveGame = async (gameId: number) => {
  if (!confirm('Remove this game from the collection?')) return;
  try {
    await collectionStore.removeGameFromCollection(collectionId.value, gameId);
  } catch (err: any) {
    alert(err.message || 'Error removing game');
  }
};
</script>

<template>
  <div class="col-detail-container">
    <div class="back-nav">
      <router-link to="/collections" class="back-link">← Back to Collections</router-link>
    </div>

    <div v-if="collectionStore.loading && !collectionStore.currentCollection" class="loading-state">
      <div class="spinner"></div>
      <p>Loading collection...</p>
    </div>

    <div v-else-if="collectionStore.currentCollection" class="col-content">
      <!-- Collection Banner -->
      <section class="banner-card" :class="{ 'official-banner': collectionStore.currentCollection.is_official }">
        <div class="banner-top">
          <span v-if="collectionStore.currentCollection.is_official" class="official-pill">
            ⭐ Official MetaGaming Collection
          </span>
          <span v-else class="community-pill">
            👥 Community List
          </span>

          <div v-if="canManage" class="owner-controls">
            <button @click="isEditing = !isEditing" class="btn-ctrl">
              {{ isEditing ? 'Cancel Edit' : 'Edit Collection' }}
            </button>
            <button @click="handleDelete" class="btn-ctrl-danger" :disabled="isDeleting">
              Delete
            </button>
          </div>
        </div>

        <h1 class="col-title">{{ collectionStore.currentCollection.title }}</h1>
        <p class="col-description">
          {{ collectionStore.currentCollection.description || 'No description provided.' }}
        </p>

        <div class="banner-meta">
          <span>
            Curated by
            <router-link
              :to="`/profile/${collectionStore.currentCollection.user_id}`"
              class="creator-link"
            >
              @{{ collectionStore.currentCollection.creator_username }}
            </router-link>
          </span>
          <span>•</span>
          <span>
            {{ collectionStore.currentCollection.games_count }}
            {{ collectionStore.currentCollection.games_count === 1 ? 'game' : 'games' }}
          </span>
        </div>

        <!-- Inline Editor -->
        <div v-if="isEditing" class="edit-box">
          <h3>Edit Collection Details</h3>
          <div v-if="editError" class="modal-error">{{ editError }}</div>
          <div class="form-group">
            <label>Title</label>
            <input v-model="editTitle" type="text" class="form-input" />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea v-model="editDescription" rows="3" class="form-textarea"></textarea>
          </div>
          <button @click="handleUpdate" class="btn-primary">Save Changes</button>
        </div>
      </section>

      <!-- Games Grid -->
      <section class="games-section">
        <h2>Games in this Collection ({{ collectionStore.currentCollection.games?.length || 0 }})</h2>

        <div
          v-if="collectionStore.currentCollection.games && collectionStore.currentCollection.games.length > 0"
          class="games-grid"
        >
          <div
            v-for="game in collectionStore.currentCollection.games"
            :key="game.id"
            class="game-card"
          >
            <div class="game-cover-wrap">
              <img
                v-if="game.photos && game.photos.length"
                :src="game.photos[0]"
                :alt="game.title"
                class="game-cover"
              />
              <div v-else class="game-placeholder">🎮</div>
            </div>

            <div class="game-info">
              <router-link :to="`/games/${game.id}`" class="game-title">
                {{ game.title }}
              </router-link>

              <div class="game-platforms">
                <span v-for="plat in game.platforms" :key="plat" class="plat-tag">
                  {{ plat }}
                </span>
              </div>

              <div class="game-rating-row">
                <span class="score-pill">⭐ {{ game.average_rating > 0 ? game.average_rating.toFixed(1) : 'N/A' }}</span>
                <span class="reviews-count">{{ game.reviews_count }} reviews</span>
              </div>

              <button
                v-if="canManage"
                @click="handleRemoveGame(game.id)"
                class="btn-remove-game"
              >
                Remove from List
              </button>
            </div>
          </div>
        </div>

        <div v-else class="empty-games">
          <p>No games have been added to this collection yet.</p>
          <router-link to="/games" class="btn-primary">Browse Games to Add</router-link>
        </div>
      </section>
    </div>

    <div v-else class="empty-state">
      <p>Collection not found or private.</p>
      <router-link to="/collections" class="btn-primary">Back to Collections</router-link>
    </div>
  </div>
</template>

<style scoped>
.col-detail-container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.back-nav {
  margin-bottom: 1.5rem;
}

.back-link {
  color: #6366f1;
  text-decoration: none;
  font-weight: 600;
}

.banner-card {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 16px;
  padding: 2rem;
  margin-bottom: 2.5rem;
}

.banner-card.official-banner {
  border-left: 6px solid #f59e0b;
}

.banner-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.official-pill {
  background: #fef3c7;
  color: #b45309;
  padding: 0.3rem 0.8rem;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 700;
}

.community-pill {
  background: #f3f4f6;
  color: #4b5563;
  padding: 0.3rem 0.8rem;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 600;
}

.owner-controls {
  display: flex;
  gap: 0.5rem;
}

.btn-ctrl {
  background: transparent;
  border: 1px solid var(--border-color, #d1d5db);
  padding: 0.4rem 0.85rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-ctrl-danger {
  background: transparent;
  border: 1px solid #ef4444;
  color: #ef4444;
  padding: 0.4rem 0.85rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.col-title {
  font-size: 2.25rem;
  font-weight: 800;
  margin: 0 0 0.75rem 0;
}

.col-description {
  font-size: 1.1rem;
  line-height: 1.6;
  color: var(--text-color, #374151);
  margin-bottom: 1.25rem;
}

.banner-meta {
  display: flex;
  gap: 0.75rem;
  font-size: 0.95rem;
  color: var(--text-muted, #6b7280);
}

.creator-link {
  color: #4f46e5;
  font-weight: 600;
  text-decoration: none;
}

.edit-box {
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
  box-sizing: border-box;
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1.5rem;
  margin-top: 1.5rem;
}

.game-card {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.game-cover-wrap {
  height: 150px;
  background: #e2e8f0;
}

.game-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.game-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
}

.game-info {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.game-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-color, #111827);
  text-decoration: none;
  margin-bottom: 0.5rem;
}

.game-platforms {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.75rem;
}

.plat-tag {
  background: var(--chip-bg, #f3f4f6);
  font-size: 0.75rem;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.game-rating-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: auto;
  margin-bottom: 0.75rem;
}

.score-pill {
  font-weight: 700;
  color: #f59e0b;
}

.reviews-count {
  font-size: 0.8rem;
  color: var(--text-muted, #6b7280);
}

.btn-remove-game {
  background: transparent;
  border: 1px solid #fecaca;
  color: #dc2626;
  padding: 0.35rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-remove-game:hover {
  background: #fef2f2;
}

.empty-games {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-muted, #6b7280);
}

.btn-primary {
  background: #4f46e5;
  color: #fff;
  border: none;
  padding: 0.6rem 1.25rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
}

@media (max-width: 640px) {
  .col-detail-container {
    padding: 1.25rem 0.75rem;
  }
  .banner-card {
    padding: 1.25rem;
  }
  .banner-top {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
  .banner-footer {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  .games-grid {
    grid-template-columns: 1fr;
  }
}
</style>
