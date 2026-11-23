import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import CollectionsView from '../src/views/CollectionsView.vue';
import CollectionDetailView from '../src/views/CollectionDetailView.vue';
import { useAuthStore } from '../src/stores/auth';
import { useCollectionStore } from '../src/stores/collection';

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { id: '1' },
  }),
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('Game Collections Views & Feature', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders collections with official tag and community list tag', () => {
    const colStore = useCollectionStore();
    colStore.collections = [
      {
        id: 1,
        user_id: 1,
        creator_username: 'admin',
        title: 'GOTY Hall of Fame',
        description: 'The all-time greatest masterpieces.',
        is_official: true,
        is_public: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        games_count: 5,
      },
      {
        id: 2,
        user_id: 42,
        creator_username: 'PixelWarrior',
        title: 'My Favorite 90s JRPGs',
        description: 'Nostalgic golden era role-playing gems.',
        is_official: false,
        is_public: true,
        created_at: '2026-01-02T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
        games_count: 3,
      },
    ];

    const wrapper = mount(CollectionsView, {
      global: {
        stubs: {
          'router-link': { template: '<a><slot /></a>' },
        },
      },
    });

    expect(wrapper.text()).toContain('Curated Game Collections');
    expect(wrapper.text()).toContain('GOTY Hall of Fame');
    expect(wrapper.text()).toContain('Official Thematic List');
    expect(wrapper.text()).toContain('My Favorite 90s JRPGs');
    expect(wrapper.text()).toContain('Community List');
  });

  it('renders Collection Detail view with games and owner controls', () => {
    const authStore = useAuthStore();
    const colStore = useCollectionStore();

    authStore.setAuth(
      {
        id: 42,
        username: 'PixelWarrior',
        email: 'pixel@example.com',
        role: 'user',
        is_admin: false,
        created_at: '2026-01-01T00:00:00Z',
      },
      'fake_token'
    );

    colStore.currentCollection = {
      id: 2,
      user_id: 42,
      creator_username: 'PixelWarrior',
      title: 'My Favorite 90s JRPGs',
      description: 'Nostalgic golden era role-playing gems.',
      is_official: false,
      is_public: true,
      created_at: '2026-01-02T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
      games_count: 1,
      games: [
        {
          id: 99,
          title: 'Chrono Trigger',
          description: 'A legendary time travel RPG',
          platforms: ['SNES', 'PC'],
          photos: [],
          average_rating: 9.8,
          reviews_count: 120,
          created_at: '2026-01-02T00:00:00Z',
          updated_at: '2026-01-02T00:00:00Z',
        },
      ],
    };

    const wrapper = mount(CollectionDetailView, {
      global: {
        stubs: {
          'router-link': { template: '<a><slot /></a>' },
        },
      },
    });

    expect(wrapper.text()).toContain('My Favorite 90s JRPGs');
    expect(wrapper.text()).toContain('Chrono Trigger');
    expect(wrapper.text()).toContain('9.8');
    expect(wrapper.text()).toContain('Edit Collection');
    expect(wrapper.text()).toContain('Remove from List');
  });
});
