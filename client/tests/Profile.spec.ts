import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ProfileView from '../src/views/ProfileView.vue';
import { useAuthStore } from '../src/stores/auth';
import { useProfileStore } from '../src/stores/profile';

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { id: '42' },
  }),
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('Gamer Profile & Library Tracker View', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders gamer profile info and statistics accurately', async () => {
    const authStore = useAuthStore();
    const profileStore = useProfileStore();

    authStore.setAuth(
      {
        id: 42,
        username: 'ProGamer99',
        email: 'progamer@example.com',
        role: 'user',
        is_admin: false,
        created_at: '2026-01-01T00:00:00.000Z',
      },
      'token_123'
    );

    profileStore.profile = {
      userId: 42,
      username: 'ProGamer99',
      role: 'user',
      bio: 'Lover of open world adventures.',
      avatar_url: '',
      preferred_platforms: ['PC', 'PlayStation 5'],
      created_at: '2026-01-01T00:00:00.000Z',
      stats: {
        total_games_tracked: 12,
        total_hours_played: 245.5,
        games_by_status: {
          want_to_play: 4,
          playing: 2,
          completed: 5,
          dropped: 1,
        },
      },
    };

    profileStore.library = [
      {
        id: 1,
        user_id: 42,
        game_id: 10,
        game_title: 'Elden Ring',
        status: 'completed',
        hours_played: 120,
        platform: 'PC',
        personal_score: 10,
        created_at: '2026-01-02T00:00:00.000Z',
        updated_at: '2026-01-10T00:00:00.000Z',
      },
    ];

    const wrapper = mount(ProfileView, {
      global: {
        stubs: {
          'router-link': { template: '<a><slot /></a>' }
        },
      },
    });

    expect(wrapper.text()).toContain('ProGamer99');
    expect(wrapper.text()).toContain('Lover of open world adventures.');
    expect(wrapper.text()).toContain('12');
    expect(wrapper.text()).toContain('245.5h');
    expect(wrapper.text()).toContain('Elden Ring');
    expect(wrapper.text()).toContain('Completed');
    expect(wrapper.text()).toContain('120 hrs');
    expect(wrapper.text()).toContain('⭐ 10/10');
  });

  it('allows toggling profile edit form for the profile owner', async () => {
    const authStore = useAuthStore();
    const profileStore = useProfileStore();

    authStore.setAuth(
      {
        id: 42,
        username: 'ProGamer99',
        email: 'progamer@example.com',
        role: 'user',
        is_admin: false,
        created_at: '2026-01-01T00:00:00.000Z',
      },
      'token_123'
    );

    profileStore.profile = {
      userId: 42,
      username: 'ProGamer99',
      role: 'user',
      bio: '',
      avatar_url: '',
      preferred_platforms: [],
      created_at: '2026-01-01T00:00:00.000Z',
      stats: {
        total_games_tracked: 0,
        total_hours_played: 0,
        games_by_status: {
          want_to_play: 0,
          playing: 0,
          completed: 0,
          dropped: 0,
        },
      },
    };

    const wrapper = mount(ProfileView, {
      global: {
        stubs: {
          'router-link': { template: '<a><slot /></a>' }
        },
      },
    });

    const editBtn = wrapper.find('.btn-edit-profile');
    expect(editBtn.exists()).toBe(true);
    expect(wrapper.find('.edit-profile-card').exists()).toBe(false);

    await editBtn.trigger('click');
    expect(wrapper.find('.edit-profile-card').exists()).toBe(true);
    expect(wrapper.text()).toContain('Edit Profile Details');
  });
});
