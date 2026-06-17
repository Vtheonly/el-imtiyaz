/**
 * Global type declarations for the renderer.
 * Augments `window` with the preload-exposed API.
 */

import type { ElImtiyazApi } from '../../preload/index';

declare global {
  interface Window {
    elImtiyaz: ElImtiyazApi;
  }
}

export {};
