import type { AccountPreferences, TextSize, ThemePreference } from '../accounts.contract';
import type { Account } from './account';

export const THEMES: readonly ThemePreference[] = ['light', 'dark', 'system'];
export const TEXT_SIZES: readonly TextSize[] = ['normal', 'large'];

// Tema claro por padrão: o app é usado ao ar livre, sob o sol, onde o fundo claro se lê melhor.
export const DEFAULT_PREFERENCES: AccountPreferences = { theme: 'light', text_size: 'normal', high_contrast: false };

// Só os campos conhecidos: contas antigas podem ter guardado `whatsapp_alerts` (avisos por WhatsApp, retirados).
export function preferencesOf(account: Account): AccountPreferences {
  const saved: Partial<AccountPreferences> = account.preferences ?? {};
  return {
    theme: saved.theme ?? DEFAULT_PREFERENCES.theme,
    text_size: saved.text_size ?? DEFAULT_PREFERENCES.text_size,
    high_contrast: saved.high_contrast ?? DEFAULT_PREFERENCES.high_contrast
  };
}
