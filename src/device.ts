/**
 * Web device-field collection for deferred match. Each platform SDK collects
 * the SAME logical fields (see shared-spec/RECIPE.md) so the server computes a
 * consistent signature. The server fills in the IP it observes.
 */
export interface DeviceFields {
  screenWidth: number;
  pixelRatio: number;
  language: string;
  timezone: string;
}

export function collectDevice(): DeviceFields {
  return {
    screenWidth: Math.round(window.screen.width),
    pixelRatio: window.devicePixelRatio || 1,
    language: navigator.language || 'en',
    timezone: resolveTimezone(),
  };
}

function resolveTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'XX';
  } catch {
    return 'XX';
  }
}
