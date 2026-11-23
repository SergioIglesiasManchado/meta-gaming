<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useCollectionStore } from '../stores/collection';
import { useAuthStore } from '../stores/auth';

const collectionStore = useCollectionStore();
const authStore = useAuthStore();

const activeTab = ref<'all' | 'official' | 'my'>('all');
const searchQuery = ref('');
const isModalOpen = ref(false);

const newTitle = ref('');
const newDescription = ref('');
const newIsOfficial = ref(false);
const newIsPublic = ref(true);
const modalError = ref('');
const isSubmitting = ref(false);

const filteredCollections = computed(() => {
  return collectionStore.collections.filter((col) => {
    if (activeTab.value === 'official' && !col.is_official) return false;
    if (activeTab.value === 'my' && col.user_id !== authStore.user?.id) return false;
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase();
      return (
        col.title.toLowerCase().includes(q) ||
        col.description.toLowerCase().includes(q)
      );
    }
    return true;
  });
});

const loadCollections = async () => {
  await collectionStore.fetchCollections(undefined, searchQuery.value);
};

onMounted(() => {
  loadCollections();
});

const handleSearch = () => {
  loadCollections();
};

const handleCreateCollection = async () => {
  modalError.value = '';
  if (!newTitle.value.trim()) {
    modalError.value = 'Please provide a collection title';
    return;
  }

  isSubmitting.value = true;
  try {
    await collectionStore.createCollection({
      title: newTitle.value.trim(),
      description: newDescription.value.trim(),
      is_official: authStore.isAdmin ? newIsOfficial.value : false,
      is_public: newIsPublic.value,
    });
    newTitle.value = '';
    newDescription.value = '';
    newIsOfficial.value = false;
    newIsPublic.value = true;
    isModalOpen.value = false;
  } catch (err: any) {
    modalError.value = err.message || 'Error creating collection';
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="collections-container">
    <div class="collections-header">
      <div>
        <h1 class="page-title">Curated Game Collections</h1>
        <p class="page-subtitle">
          Explore official thematic lists curated by MetaGaming staff, or discover community-made game lists.
        </p>
      </div>
      <div v-if="authStore.isAuthenticated" class="header-actions">
        <button @click="isModalOpen = true" class="btn-create-col">
          + Create Collection
        </button>
      </div>
    </div>

    <!-- Filters and tabs -->
    <div class="controls-bar">
      <div class="tabs">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'all' }"
          @click="activeTab = 'all'"
        >
          All Collections
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'official' }"
          @click="activeTab = 'official'"
        >
          ⭐ Official MetaGaming Lists
        </button>
        <button
          v-if="authStore.isAuthenticated"
          class="tab-btn"
          :class="{ active: activeTab === 'my' }"
          @click="activeTab = 'my'"
        >
          👤 My Collections
        </button>
      </div>

      <div class="search-wrap">
        <input
          v-model="searchQuery"
          @keyup.enter="handleSearch"
          type="text"
          placeholder="Search collections..."
          class="search-input"
        />
        <button @click="handleSearch" class="btn-search">Search</button>
      </div>
    </div>

    <!-- Collections Grid -->
    <div v-if="collectionStore.loading && collectionStore.collections.length === 0" class="loading-state">
      <div class="spinner"></div>
      <p>Loading curated collections...</p>
    </div>

    <div v-else-if="filteredCollections.length > 0" class="collections-grid">
      <div
        v-for="col in filteredCollections"
        :key="col.id"
        class="col-card"
        :class="{ 'official-card': col.is_official }"
      >
        <div class="card-header">
          <span v-if="col.is_official" class="official-pill">
            ⭐ Official Thematic List
          </span>
          <span v-else class="community-pill">
            👥 Community List
          </span>
          <span class="games-badge">{{ col.games_count }} {{ col.games_count === 1 ? 'game' : 'games' }}</span>
        </div>

        <h2 class="col-title">
          <router-link :to="`/collections/${col.id}`" class="col-link">
            {{ col.title }}
          </router-link>
        </h2>

        <p class="col-desc">
          {{ col.description || 'No description provided.' }}
        </p>

        <div class="col-footer">
          <span class="curator-info">
            Curated by <strong>{{ col.creator_username || 'Anonymous' }}</strong>
          </span>
          <router-link :to="`/collections/${col.id}`" class="btn-view">
            View Collection →
          </router-link>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <p>No collections found matching your criteria.</p>
      <button v-if="authStore.isAuthenticated" @click="isModalOpen = true" class="btn-create-col">
        Create the First One!
      </button>
    </div>

    <!-- Create Collection Modal -->
    <div v-if="isModalOpen" class="modal-backdrop" @click.self="isModalOpen = false">
      <div class="modal-card">
        <div class="modal-header">
          <h2>Create New Collection</h2>
          <button @click="isModalOpen = false" class="close-btn">&times;</button>
        </div>

        <div class="modal-body">
          <div v-if="modalError" class="modal-error">{{ modalError }}</div>

          <div class="form-group">
            <label for="col-title">Collection Title *</label>
            <input
              id="col-title"
              v-model="newTitle"
              type="text"
              placeholder="e.g. Best Sci-Fi RPGs of the Decade"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="col-desc">Description</label>
            <textarea
              id="col-desc"
              v-model="newDescription"
              rows="3"
              placeholder="Explain the theme or why you selected these games..."
              class="form-textarea"
            ></textarea>
          </div>

          <div class="checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="newIsPublic" />
              <span>Public (visible to all gamers)</span>
            </label>
          </div>

          <div v-if="authStore.isAdmin" class="checkbox-group">
            <label class="checkbox-label admin-check">
              <input type="checkbox" v-model="newIsOfficial" />
              <span>⭐ Mark as Official MetaGaming Thematic Collection</span>
            </label>
          </div>
        </div>

        <div class="modal-actions">
          <button @click="isModalOpen = false" class="btn-cancel">Cancel</button>
          <button
            @click="handleCreateCollection"
            class="btn-primary"
            :disabled="isSubmitting"
          >
            {{ isSubmitting ? 'Creating...' : 'Create Collection' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.collections-container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.collections-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.page-title {
  font-size: 2.25rem;
  font-weight: 800;
  margin-bottom: 0.5rem;
}

.page-subtitle {
  color: var(--text-muted, #6b7280);
  font-size: 1.05rem;
  max-width: 650px;
}

.btn-create-col {
  background: #6366f1;
  color: #fff;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-create-col:hover {
  background: #4f46e5;
}

.controls-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.tabs {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
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

.search-wrap {
  display: flex;
  gap: 0.5rem;
}

.search-input {
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

.collections-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.col-card {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 14px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s, box-shadow 0.2s;
}

.col-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
}

.col-card.official-card {
  border-left: 4px solid #f59e0b;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.85rem;
}

.official-pill {
  background: #fef3c7;
  color: #b45309;
  padding: 0.25rem 0.65rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.community-pill {
  background: #f3f4f6;
  color: #4b5563;
  padding: 0.25rem 0.65rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.games-badge {
  font-size: 0.825rem;
  color: var(--text-muted, #6b7280);
  font-weight: 600;
}

.col-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
}

.col-link {
  color: var(--text-color, #111827);
  text-decoration: none;
}

.col-link:hover {
  color: #4f46e5;
}

.col-desc {
  color: var(--text-muted, #4b5563);
  font-size: 0.925rem;
  line-height: 1.5;
  margin-bottom: 1.5rem;
  flex: 1;
}

.col-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--border-color, #f3f4f6);
  padding-top: 1rem;
  font-size: 0.85rem;
}

.curator-info {
  color: var(--text-muted, #6b7280);
}

.btn-view {
  color: #4f46e5;
  font-weight: 700;
  text-decoration: none;
}

.btn-view:hover {
  text-decoration: underline;
}

.empty-state {
  text-align: center;
  padding: 4rem 1rem;
  color: var(--text-muted, #6b7280);
}

/* Modal styles */
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
  border-radius: 16px;
  width: 90%;
  max-width: 520px;
  padding: 2rem;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.close-btn {
  background: transparent;
  border: none;
  font-size: 1.75rem;
  cursor: pointer;
  color: var(--text-muted, #6b7280);
}

.form-group {
  margin-bottom: 1.25rem;
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
  padding: 0.65rem 0.85rem;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 8px;
  background: var(--input-bg, #ffffff);
  color: var(--text-color, #111827);
  box-sizing: border-box;
}

.checkbox-group {
  margin-bottom: 1rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  cursor: pointer;
}

.admin-check {
  color: #b45309;
  font-weight: 600;
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
  padding: 0.6rem 1.25rem;
  border-radius: 8px;
  cursor: pointer;
}

.btn-primary {
  background: #4f46e5;
  color: #fff;
  border: none;
  padding: 0.6rem 1.25rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

.modal-error {
  background: #fee2e2;
  color: #dc2626;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

@media (max-width: 640px) {
  .collections-container {
    padding: 1.25rem 0.75rem;
  }
  .collections-header {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
  .controls-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
  .search-wrap {
    width: 100%;
  }
  .search-input {
    flex: 1;
    width: 100%;
  }
  .collections-grid {
    grid-template-columns: 1fr;
  }
}
</style>
