export function getPlatformUrl(isDevelopment = import.meta.env.DEV) {
  return isDevelopment ? 'http://127.0.0.1:3000/evaluate' : '/evaluate'
}
