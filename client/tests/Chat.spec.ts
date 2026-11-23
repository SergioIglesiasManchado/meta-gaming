import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ChatView from '../src/views/ChatView.vue';
import { useAuthStore } from '../src/stores/auth';
import { useChatStore } from '../src/stores/chat';
import { useSocialStore } from '../src/stores/social';

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: {},
  }),
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('Social Friends & Messenger Chat View', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders conversations and active conversation thread', async () => {
    const authStore = useAuthStore();
    const chatStore = useChatStore();

    authStore.setAuth(
      {
        id: 10,
        username: 'Player1',
        email: 'p1@example.com',
        role: 'user',
        is_admin: false,
        created_at: '2026-01-01T00:00:00Z',
      },
      'token_1'
    );

    chatStore.conversations = [
      {
        id: 1,
        is_group: false,
        title: 'Player2',
        created_by: 10,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        participants: [
          {
            id: 1,
            conversation_id: 1,
            user_id: 10,
            username: 'Player1',
            joined_at: '2026-01-01T00:00:00Z',
            last_read_at: '2026-01-01T00:00:00Z',
          },
          {
            id: 2,
            conversation_id: 1,
            user_id: 20,
            username: 'Player2',
            joined_at: '2026-01-01T00:00:00Z',
            last_read_at: '2026-01-01T00:00:00Z',
          },
        ],
        last_message: {
          id: 1,
          conversation_id: 1,
          sender_id: 20,
          sender_username: 'Player2',
          content: 'Ready to raid?',
          created_at: '2026-01-01T00:00:00Z',
        },
      },
    ];

    chatStore.currentConversation = chatStore.conversations[0];
    chatStore.messages = [
      {
        id: 1,
        conversation_id: 1,
        sender_id: 20,
        sender_username: 'Player2',
        content: 'Ready to raid?',
        created_at: '2026-01-01T00:00:00Z',
      },
    ];

    const wrapper = mount(ChatView, {
      global: {
        stubs: {
          'router-link': { template: '<a><slot /></a>' },
        },
      },
    });

    expect(wrapper.text()).toContain('Messages');
    expect(wrapper.text()).toContain('Player2');
    expect(wrapper.text()).toContain('Ready to raid?');
    expect(wrapper.text()).toContain('Direct 1-on-1 Chat');
  });

  it('switches between Chats tab and Friends roster tab', async () => {
    const authStore = useAuthStore();
    const socialStore = useSocialStore();

    authStore.setAuth(
      {
        id: 10,
        username: 'Player1',
        email: 'p1@example.com',
        role: 'user',
        is_admin: false,
        created_at: '2026-01-01T00:00:00Z',
      },
      'token_1'
    );

    socialStore.friends = [
      {
        friendship_id: 5,
        friendship_date: '2026-01-01T00:00:00Z',
        user_id: 20,
        username: 'BestieGamer',
        role: 'user',
      },
    ];

    const wrapper = mount(ChatView, {
      global: {
        stubs: {
          'router-link': { template: '<a><slot /></a>' },
        },
      },
    });

    // Default tab is chats
    expect(wrapper.text()).not.toContain('My Friends');

    // Click Friends tab
    const tabs = wrapper.findAll('.tab-btn');
    await tabs[1].trigger('click');

    expect(wrapper.text()).toContain('My Friends');
    expect(wrapper.text()).toContain('BestieGamer');
    expect(wrapper.text()).toContain('💬 Chat');
  });

  it('correctly distinguishes incoming vs sent message bubbles with theme-adaptive styling classes', async () => {
    const authStore = useAuthStore();
    const chatStore = useChatStore();

    authStore.setAuth(
      {
        id: 10,
        username: 'Player1',
        email: 'p1@example.com',
        role: 'user',
        is_admin: false,
        created_at: '2026-01-01T00:00:00Z',
      },
      'token_1'
    );

    chatStore.conversations = [
      {
        id: 1,
        is_group: false,
        title: 'Player2',
        created_by: 10,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        participants: [],
      },
    ];

    chatStore.currentConversation = chatStore.conversations[0];
    chatStore.messages = [
      {
        id: 1,
        conversation_id: 1,
        sender_id: 20,
        sender_username: 'Player2',
        content: 'Incoming message from friend',
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 2,
        conversation_id: 1,
        sender_id: 10,
        sender_username: 'Player1',
        content: 'My reply message',
        created_at: '2026-01-01T00:01:00Z',
      },
    ];

    const wrapper = mount(ChatView, {
      global: {
        stubs: {
          'router-link': { template: '<a><slot /></a>' },
        },
      },
    });

    const rows = wrapper.findAll('.message-row');
    expect(rows.length).toBe(2);
    // Incoming row: does not have .mine
    expect(rows[0].classes()).not.toContain('mine');
    expect(rows[0].find('.author-name').text()).toBe('Player2');
    expect(rows[0].find('.msg-bubble').text()).toContain('Incoming message from friend');

    // Outgoing row: has .mine
    expect(rows[1].classes()).toContain('mine');
    expect(rows[1].find('.msg-bubble').text()).toContain('My reply message');

    // Input bar elements exist
    expect(wrapper.find('.chat-input-bar').exists()).toBe(true);
    expect(wrapper.find('.message-input').exists()).toBe(true);
  });
});
