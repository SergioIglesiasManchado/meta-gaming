import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Collection, CreateCollectionDto, UpdateCollectionDto } from '../types/collection';
import { useAuthStore } from './auth';
import { apiBaseUrl, getApiUrl, parseJsonResponse } from '../config/api';

export const useCollectionStore = defineStore('collection', () => {
  const collections = ref<Collection[]>([]);
  const officialCollections = ref<Collection[]>([]);
  const currentCollection = ref<Collection | null>(null);
  const loading = ref<boolean>(false);
  const error = ref<string | null>(null);

  const fetchCollections = async (official?: boolean, search?: string): Promise<Collection[]> => {
    loading.value = true;
    error.value = null;
    const authStore = useAuthStore();
    try {
      const url = getApiUrl('/api/v1/collections');
      if (official !== undefined) {
        url.searchParams.set('official', String(official));
      }
      if (search && search.trim()) {
        url.searchParams.set('search', search.trim());
      }

      const headers: Record<string, string> = {};
      if (authStore.token) {
        headers['Authorization'] = `Bearer ${authStore.token}`;
      }

      const res = await fetch(url.toString(), { headers });
      const data = await parseJsonResponse(res);

      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch collections');
      }

      if (official === true) {
        officialCollections.value = data.data;
      } else {
        collections.value = data.data;
      }
      return data.data;
    } catch (err: any) {
      error.value = err.message || 'Error fetching collections';
      return [];
    } finally {
      loading.value = false;
    }
  };

  const fetchCollectionById = async (id: number): Promise<Collection | null> => {
    loading.value = true;
    error.value = null;
    const authStore = useAuthStore();
    try {
      const headers: Record<string, string> = {};
      if (authStore.token) {
        headers['Authorization'] = `Bearer ${authStore.token}`;
      }

      const res = await fetch(`${apiBaseUrl}/api/v1/collections/${id}`, { headers });
      const data = await parseJsonResponse(res);

      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch collection details');
      }

      currentCollection.value = data.data;
      return currentCollection.value;
    } catch (err: any) {
      error.value = err.message || 'Error loading collection';
      currentCollection.value = null;
      return null;
    } finally {
      loading.value = false;
    }
  };

  const createCollection = async (dto: CreateCollectionDto): Promise<Collection> => {
    loading.value = true;
    error.value = null;
    const authStore = useAuthStore();
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/collections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
        body: JSON.stringify(dto),
      });

      const data = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create collection');
      }

      await fetchCollections();
      return data.data;
    } catch (err: any) {
      error.value = err.message || 'Error creating collection';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const updateCollection = async (id: number, dto: UpdateCollectionDto): Promise<Collection> => {
    loading.value = true;
    error.value = null;
    const authStore = useAuthStore();
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/collections/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
        body: JSON.stringify(dto),
      });

      const data = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update collection');
      }

      currentCollection.value = data.data;
      return currentCollection.value!;
    } catch (err: any) {
      error.value = err.message || 'Error updating collection';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const deleteCollection = async (id: number): Promise<boolean> => {
    loading.value = true;
    error.value = null;
    const authStore = useAuthStore();
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/collections/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authStore.token}`,
        },
      });

      if (!res.ok) {
        const data = await parseJsonResponse(res);
        throw new Error(data.message || 'Failed to delete collection');
      }

      collections.value = collections.value.filter((c) => c.id !== id);
      officialCollections.value = officialCollections.value.filter((c) => c.id !== id);
      return true;
    } catch (err: any) {
      error.value = err.message || 'Error deleting collection';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const addGameToCollection = async (collectionId: number, gameId: number): Promise<void> => {
    const authStore = useAuthStore();
    const res = await fetch(`${apiBaseUrl}/api/v1/collections/${collectionId}/games`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({ gameId }),
    });

    const data = await parseJsonResponse(res);
    if (!res.ok) {
      throw new Error(data.message || 'Failed to add game to collection');
    }
    await fetchCollectionById(collectionId);
  };

  const removeGameFromCollection = async (collectionId: number, gameId: number): Promise<void> => {
    const authStore = useAuthStore();
    const res = await fetch(`${apiBaseUrl}/api/v1/collections/${collectionId}/games/${gameId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authStore.token}`,
      },
    });

    if (!res.ok) {
      const data = await parseJsonResponse(res);
      throw new Error(data.message || 'Failed to remove game from collection');
    }
    await fetchCollectionById(collectionId);
  };

  return {
    collections,
    officialCollections,
    currentCollection,
    loading,
    error,
    fetchCollections,
    fetchCollectionById,
    createCollection,
    updateCollection,
    deleteCollection,
    addGameToCollection,
    removeGameFromCollection,
  };
});
