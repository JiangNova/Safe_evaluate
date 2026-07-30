import { TIANXIN_BASE } from '../config/routes';

const PLATFORM_PATH =
  /^\/(?:evaluate|history|rules|stats)(?:[/?#]|$)|^\/report(?:\/|[?#]|$)/;

export function getSafeRedirect(from) {
  if (typeof from !== 'string') return '/evaluate';
  if (!from.startsWith('/') || from.startsWith('//')) return '/evaluate';
  const normalized =
    from === TIANXIN_BASE
      ? '/evaluate'
      : from.startsWith(`${TIANXIN_BASE}/`)
        ? from.slice(TIANXIN_BASE.length)
        : from;
  return PLATFORM_PATH.test(normalized) ? normalized : '/evaluate';
}
