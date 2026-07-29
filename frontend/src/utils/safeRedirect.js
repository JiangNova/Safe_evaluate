const PLATFORM_PATH =
  /^\/(?:evaluate|history|rules|stats)(?:[/?#]|$)|^\/report(?:\/|[?#]|$)/;

export function getSafeRedirect(from) {
  if (typeof from !== 'string') return '/evaluate';
  if (!from.startsWith('/') || from.startsWith('//')) return '/evaluate';
  return PLATFORM_PATH.test(from) ? from : '/evaluate';
}
