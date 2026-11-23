import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import App from '../src/App.vue';
import { router } from '../src/router/index';

const createLocalStorage = (): Storage => {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value))
  };
};

describe('settings and appearance', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: createLocalStorage()
    });
    document.documentElement.removeAttribute('data-theme');
    setActivePinia(createPinia());
  });

  it('opens the settings panel and toggles dark mode with a persisted preference', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [router],
        stubs: {
          'router-view': true
        }
      }
    });

    expect(wrapper.find('#settings-menu').exists()).toBe(false);
    await wrapper.get('[aria-label="Settings"]').trigger('click');

    const themeToggle = wrapper.get('[data-testid="settings-theme-toggle"]');
    expect(wrapper.find('#settings-menu').exists()).toBe(true);
    expect(themeToggle.attributes('aria-checked')).toBe('false');

    await themeToggle.trigger('click');

    expect(themeToggle.attributes('aria-checked')).toBe('true');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('mg_theme')).toBe('dark');

    await themeToggle.trigger('click');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(window.localStorage.getItem('mg_theme')).toBe('light');

    wrapper.unmount();
  });

  it('restores a saved dark theme and closes the panel on Escape or an outside click', async () => {
    window.localStorage.setItem('mg_theme', 'dark');

    const wrapper = mount(App, {
      global: {
        plugins: [router],
        stubs: {
          'router-view': true
        }
      }
    });

    expect(document.documentElement.dataset.theme).toBe('dark');

    await wrapper.get('[aria-label="Settings"]').trigger('click');
    expect(wrapper.find('#settings-menu').exists()).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTick();
    expect(wrapper.find('#settings-menu').exists()).toBe(false);

    await wrapper.get('[aria-label="Settings"]').trigger('click');
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();
    expect(wrapper.find('#settings-menu').exists()).toBe(false);

    wrapper.unmount();
  });
});
