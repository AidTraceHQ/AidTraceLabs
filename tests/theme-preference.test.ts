import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readThemePreference, writeThemePreference } from '../src/theme-preference.js';

function createMemoryStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
  };
}

async function loadApp(): Promise<ComponentType> {
  const mod = await vi.importActual<{ default: ComponentType }>('../src/App.tsx');
  return mod.default;
}

describe('stored theme preference', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to light and reads back the same stored theme after a simulated reload', async () => {
    const storage = createMemoryStorage();
    vi.stubGlobal('window', { localStorage: storage });

    expect(readThemePreference(storage)).toBe('light');

    writeThemePreference('dark', storage);
    expect(storage.setItem).toHaveBeenCalledWith('aidtrace.theme', 'dark');
    expect(readThemePreference(storage)).toBe('dark');
    expect(readThemePreference()).toBe('dark');

    const App = await loadApp();
    const darkReloadMarkup = renderToStaticMarkup(createElement(App));
    expect(darkReloadMarkup).toContain('class="app dark"');
    expect(darkReloadMarkup).toContain('aria-label="Use light theme"');

    writeThemePreference('light');
    expect(storage.setItem).toHaveBeenCalledWith('aidtrace.theme', 'light');
    expect(readThemePreference()).toBe('light');

    const lightReloadMarkup = renderToStaticMarkup(createElement(App));
    expect(lightReloadMarkup).toContain('class="app"');
    expect(lightReloadMarkup).not.toContain('class="app dark"');
    expect(lightReloadMarkup).toContain('aria-label="Use dark theme"');
  });

  it('returns the default theme for invalid stored values and renders App without throwing', async () => {
    const storage = createMemoryStorage({ 'aidtrace.theme': 'invalid-theme' });
    vi.stubGlobal('window', { localStorage: storage });

    expect(readThemePreference(storage)).toBe('light');
    storage.getItem.mockReturnValueOnce('DARK');
    expect(readThemePreference(storage)).toBe('light');
    storage.getItem.mockReturnValueOnce('');
    expect(readThemePreference(storage)).toBe('light');

    const App = await loadApp();
    let markup = '';
    expect(() => {
      markup = renderToStaticMarkup(createElement(App));
    }).not.toThrow();
    expect(markup).toContain('class="app"');
    expect(markup).not.toContain('class="app dark"');
    expect(markup).toContain('aria-label="Use dark theme"');
  });

  it('returns the default theme without throwing when storage throws or is unavailable', async () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error('storage disabled');
      },
      setItem: () => {
        throw new Error('storage disabled');
      },
    };
    expect(readThemePreference(throwingStorage)).toBe('light');
    expect(() => writeThemePreference('dark', throwingStorage)).not.toThrow();

    const App = await loadApp();

    vi.stubGlobal('window', { localStorage: throwingStorage });
    let throwingStorageMarkup = '';
    expect(() => {
      throwingStorageMarkup = renderToStaticMarkup(createElement(App));
    }).not.toThrow();
    expect(throwingStorageMarkup).toContain('class="app"');
    expect(throwingStorageMarkup).not.toContain('class="app dark"');

    const throwingWindow = {};
    Object.defineProperty(throwingWindow, 'localStorage', {
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
    vi.stubGlobal('window', throwingWindow);
    expect(readThemePreference()).toBe('light');
    expect(() => writeThemePreference('dark')).not.toThrow();
    let throwingGetterMarkup = '';
    expect(() => {
      throwingGetterMarkup = renderToStaticMarkup(createElement(App));
    }).not.toThrow();
    expect(throwingGetterMarkup).toContain('class="app"');
    expect(throwingGetterMarkup).not.toContain('class="app dark"');

    vi.stubGlobal('window', undefined);
    expect(readThemePreference()).toBe('light');
    expect(() => writeThemePreference('dark')).not.toThrow();
    let unavailableWindowMarkup = '';
    expect(() => {
      unavailableWindowMarkup = renderToStaticMarkup(createElement(App));
    }).not.toThrow();
    expect(unavailableWindowMarkup).toContain('class="app"');
    expect(unavailableWindowMarkup).not.toContain('class="app dark"');
  });
});
