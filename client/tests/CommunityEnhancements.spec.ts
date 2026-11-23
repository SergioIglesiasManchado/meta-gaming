import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import CommunityView from '../src/views/CommunityView.vue';
import { useAuthStore } from '../src/stores/auth';
import { useCommunityStore } from '../src/stores/community';

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { id: '1' },
  }),
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('Community Post Types & Reactions Frontend Tests', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders filter pills, sort controls, and post type tags', () => {
    const commStore = useCommunityStore();
    commStore.currentCommunity = {
      id: 1,
      game_id: 1,
      name: 'Cyberpunk 2077 Hub',
      description: 'Night City discussion forum',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    commStore.posts = [
      {
        id: 10,
        community_id: 1,
        user_id: 1,
        username: 'V_Merc',
        title: 'Netrunner Build Guide 2.0',
        content: 'Max out Intelligence and Quickhack queue.',
        post_type: 'guide',
        media_url: 'https://example.com/netrunner.jpg',
        upvotes_count: 42,
        has_upvoted: true,
        comments_count: 5,
        created_at: '2026-01-02T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
      },
    ];

    const wrapper = mount(CommunityView, {
      global: {
        stubs: {
          'router-link': { template: '<a><slot /></a>' },
          CommentItem: true,
        },
      },
    });

    // Check filter pills
    expect(wrapper.text()).toContain('All');
    expect(wrapper.text()).toContain('❓ Questions');
    expect(wrapper.text()).toContain('💬 Discussions');
    expect(wrapper.text()).toContain('📖 Guides');
    expect(wrapper.text()).toContain('📸 Screenshots');

    // Check post type tag and upvotes
    expect(wrapper.text()).toContain('guide');
    expect(wrapper.text()).toContain('Netrunner Build Guide 2.0');
    expect(wrapper.text()).toContain('▲ 42');
    expect(wrapper.find('.btn-upvote.upvoted').exists()).toBe(true);
  });
});
