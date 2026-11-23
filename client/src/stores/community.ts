import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Community, CommunityPost, CommunityComment, PostType } from '../types/community';
import { useAuthStore } from './auth';
import { apiBaseUrl, getApiUrl, parseJsonResponse } from '../config/api';

export const useCommunityStore = defineStore('community', () => {
  const currentCommunity = ref<Community | null>(null);
  const posts = ref<CommunityPost[]>([]);
  const currentPost = ref<CommunityPost | null>(null);
  const currentComments = ref<CommunityComment[]>([]);
  const loading = ref<boolean>(false);
  const error = ref<string | null>(null);

  const fetchCommunityByGameId = async (gameId: number): Promise<Community | null> => {
    loading.value = true;
    error.value = null;

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/communities/by-game/${gameId}`);
      const data = await parseJsonResponse(res);

      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch community');
      }

      currentCommunity.value = data.data.community;
      return currentCommunity.value;
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch community';
      return null;
    } finally {
      loading.value = false;
    }
  };

  const fetchCommunityPosts = async (
    communityId: number,
    type?: string,
    sort?: 'newest' | 'upvotes'
  ): Promise<CommunityPost[]> => {
    loading.value = true;
    error.value = null;
    const authStore = useAuthStore();

    try {
      const url = getApiUrl(`/api/v1/communities/${communityId}/posts`);
      if (type && type !== 'all') {
        url.searchParams.set('type', type);
      }
      if (sort) {
        url.searchParams.set('sort', sort);
      }

      const headers: Record<string, string> = {};
      if (authStore.token) {
        headers['Authorization'] = `Bearer ${authStore.token}`;
      }

      const res = await fetch(url.toString(), { headers });
      const data = await parseJsonResponse(res);

      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch posts');
      }

      posts.value = data.data.posts;
      return posts.value;
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch posts';
      return [];
    } finally {
      loading.value = false;
    }
  };

  const createPost = async (
    communityId: number,
    title: string,
    content: string,
    post_type: PostType = 'question',
    media_url?: string
  ): Promise<CommunityPost> => {
    const authStore = useAuthStore();
    if (!authStore.token) {
      throw new Error('You must be logged in to post');
    }

    loading.value = true;
    error.value = null;

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/communities/${communityId}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`
        },
        body: JSON.stringify({ title, content, post_type, media_url })
      });

      const data = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create post');
      }

      const newPost = data.data.post as CommunityPost;
      posts.value.unshift(newPost);
      return newPost;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create post';
      error.value = msg;
      throw new Error(msg);
    } finally {
      loading.value = false;
    }
  };

  const togglePostReaction = async (postId: number): Promise<{ upvoted: boolean; upvotes_count: number }> => {
    const authStore = useAuthStore();
    if (!authStore.token) {
      throw new Error('You must be logged in to upvote');
    }

    const res = await fetch(`${apiBaseUrl}/api/v1/communities/posts/${postId}/react`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    });

    const data = await parseJsonResponse(res);
    if (!res.ok) {
      throw new Error(data.message || 'Error reacting to post');
    }

    const { upvoted, upvotes_count } = data.data;

    // Update in posts list
    const p = posts.value.find((item) => item.id === postId);
    if (p) {
      p.has_upvoted = upvoted;
      p.upvotes_count = upvotes_count;
    }

    // Update in currentPost
    if (currentPost.value && currentPost.value.id === postId) {
      currentPost.value.has_upvoted = upvoted;
      currentPost.value.upvotes_count = upvotes_count;
    }

    return { upvoted, upvotes_count };
  };

  const fetchPostWithComments = async (
    postId: number
  ): Promise<{ post: CommunityPost; comments: CommunityComment[] } | null> => {
    loading.value = true;
    error.value = null;
    const authStore = useAuthStore();

    try {
      const headers: Record<string, string> = {};
      if (authStore.token) {
        headers['Authorization'] = `Bearer ${authStore.token}`;
      }

      const res = await fetch(`${apiBaseUrl}/api/v1/communities/posts/${postId}`, { headers });
      const data = await parseJsonResponse(res);

      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch discussion');
      }

      currentPost.value = data.data.post;
      currentComments.value = data.data.comments;
      return data.data;
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch discussion';
      return null;
    } finally {
      loading.value = false;
    }
  };

  const createComment = async (
    postId: number,
    content: string,
    parentCommentId?: number | null
  ): Promise<CommunityComment> => {
    const authStore = useAuthStore();
    if (!authStore.token) {
      throw new Error('You must be logged in to comment');
    }

    loading.value = true;
    error.value = null;

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/communities/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`
        },
        body: JSON.stringify({
          content,
          parent_comment_id: parentCommentId || null
        })
      });

      const data = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(data.message || 'Failed to post comment');
      }

      const newComment = data.data.comment as CommunityComment;

      // Re-fetch post with comments to ensure full hierarchy is updated
      await fetchPostWithComments(postId);

      return newComment;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to post comment';
      error.value = msg;
      throw new Error(msg);
    } finally {
      loading.value = false;
    }
  };

  return {
    currentCommunity,
    posts,
    currentPost,
    currentComments,
    loading,
    error,
    fetchCommunityByGameId,
    fetchCommunityPosts,
    createPost,
    togglePostReaction,
    fetchPostWithComments,
    createComment
  };
});
