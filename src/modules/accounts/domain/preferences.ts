import type { AccountPreferences, TextSize, ThemePreference } from '../accounts.contract';
import type { Account } from './account';

export const THEMES: readonly ThemePreference[] = ['light', 'dark', 'system'];
export const TEXT_SIZES: readonly TextSize[] = ['normal', 'large'];

// Tema claro por padrão: o app é usado ao ar livre, sob o sol, onde o fundo claro se lê melhor.
// O WhatsApp só com o sim da pessoa (LGPD e regras do WhatsApp para mensagens automáticas).
export const DEFAULT_PREFERENCES: AccountPreferences = { theme: 'light', text_size: 'normal', high_contrast: false, whatsapp_alerts: false };

export function preferencesOf(account: Account): AccountPreferences {
  return { ...DEFAULT_PREFERENCES, ...account.preferences };
}
