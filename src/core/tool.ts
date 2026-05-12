import type { MillSettings } from './types';

/**
 * Returns the user-visible name of the cutting tool. Used throughout the
 * UI copy so switching between chain and blade updates labels, help
 * text, banners and illustration annotations consistently.
 */
export function toolName(settings: MillSettings): 'chain' | 'blade' {
  return settings.cuttingTool;
}

/** Capitalised variant for sentence starts / table headers. */
export function toolNameCapitalised(settings: MillSettings): 'Chain' | 'Blade' {
  return settings.cuttingTool === 'chain' ? 'Chain' : 'Blade';
}
