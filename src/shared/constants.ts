/**
 * Shared constants — used across main, preload, and renderer.
 */

export const APP_NAME = 'El-Imtiyaz School System';
export const APP_VERSION = '1.0.0';

/** El-Imtiyaz Academic Brand Palette — central source of truth. */
export const PALETTE = {
  // Primary
  PRIMARY_BLUE: '#349bd4',
  DEEP_BLUE: '#2b7fb0',
  PRIMARY_BLUE_RGB: '52, 155, 212',
  DEEP_BLUE_RGB: '43, 127, 176',

  // Neutrals
  DARK_BG: '#242526',
  PANEL_BG: '#1e1f20',
  SLATE_GRAY: '#3b464c',
  OFF_WHITE: '#eff2f3',

  // Accent
  WARM_ACCENT: '#c8a98c',
  WARM_ACCENT_RGB: '200, 169, 140',

  // Extended
  MUTED_BROWN: '#836c68',

  // Status colors
  SUCCESS: '#3fa66e',
  WARNING: '#c8a98c',
  DANGER: '#c0504d',
  INFO: '#349bd4',

  // Tints (with alpha)
  PRIMARY_TINT_05: 'rgba(52, 155, 212, 0.05)',
  PRIMARY_TINT_10: 'rgba(52, 155, 212, 0.10)',
  PRIMARY_TINT_15: 'rgba(52, 155, 212, 0.15)',
  PRIMARY_TINT_25: 'rgba(52, 155, 212, 0.25)',
  PRIMARY_TINT_40: 'rgba(52, 155, 212, 0.40)',
  PRIMARY_TINT_60: 'rgba(52, 155, 212, 0.60)'
} as const;

export const CURRENCY = {
  CODE: 'DZD' as const,
  SYMBOL: 'د.ج' as const,
  LOCALE: 'ar-DZ' as const
};

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 500;
