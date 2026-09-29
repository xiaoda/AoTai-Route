export interface Settings {
  sensitivity: number;
  fov: number;
  bob: boolean;
  quality: 'eco' | 'balanced';
}
export const DEFAULT_SETTINGS: Settings = { sensitivity: 1, fov: 70, bob: false, quality: 'balanced' };
export const SETTINGS_KEY = 'aotai.settings.v1';
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export function parseSettings(raw: string | null): Settings {
  try {
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return { ...DEFAULT_SETTINGS };
    const s = v as Record<string, unknown>;
    return {
      sensitivity: typeof s.sensitivity === 'number' && Number.isFinite(s.sensitivity) ? clamp(s.sensitivity, 0.3, 2) : 1,
      fov: typeof s.fov === 'number' && Number.isFinite(s.fov) ? clamp(s.fov, 55, 90) : 70,
      bob: typeof s.bob === 'boolean' ? s.bob : false,
      quality: s.quality === 'eco' ? 'eco' : 'balanced',
    };
  } catch { return { ...DEFAULT_SETTINGS }; }
}
export function loadSettings(): Settings {
  try { return parseSettings(localStorage.getItem(SETTINGS_KEY)); }
  catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(settings: Settings): boolean {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); return true; }
  catch { return false; }
}
