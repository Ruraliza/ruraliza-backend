import type { AccountPreferences, TextSize, ThemePreference } from '../accounts.contract';
import type { Account } from './account';

export const THEMES: readonly ThemePreference[] = ['light', 'dark', 'system'];
export const TEXT_SIZES: readonly TextSize[] = ['normal', 'large'];

// Tema claro por padrão: o app é usado ao ar livre, sob o sol, onde o fundo claro se lê melhor.
export const DEFAULT_PREFERENCES: AccountPreferences = { theme: 'light', text_size: 'normal', high_contrast: false };

export function preferencesOf(account: Account): AccountPreferences {
  return { ...DEFAULT_PREFERENCES, ...account.preferences };
}
