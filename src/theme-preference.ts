export type Theme = 'light' | 'dark';
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const storageKey = 'aidtrace.theme';

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark';
}

export function readThemePreference(storage?: StorageLike): Theme {
  try {
    const stored = (storage ?? window.localStorage).getItem(storageKey);
    return isTheme(stored) ? stored : 'light';
  } catch {
    return 'light';
  }
}

export function writeThemePreference(theme: Theme, storage?: StorageLike): void {
  try {
    (storage ?? window.localStorage).setItem(storageKey, theme);
  } catch {
    // Keep the in-memory selection when browser storage is unavailable.
  }
}
