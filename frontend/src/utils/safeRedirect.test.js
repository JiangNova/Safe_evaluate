import { describe, expect, it } from 'vitest';
import { getSafeRedirect } from './safeRedirect';

describe('getSafeRedirect', () => {
  it('keeps an internal platform route', () => {
    expect(getSafeRedirect('/report/abc?tab=detail')).toBe(
      '/report/abc?tab=detail',
    );
  });

  it('keeps supported top-level platform routes', () => {
    expect(getSafeRedirect('/history#recent')).toBe('/history#recent');
  });

  it('rejects protocol-relative redirects', () => {
    expect(getSafeRedirect('//evil.example')).toBe('/evaluate');
  });

  it('rejects absolute external redirects', () => {
    expect(getSafeRedirect('https://evil.example')).toBe('/evaluate');
  });

  it('rejects unrelated same-origin routes', () => {
    expect(getSafeRedirect('/admin')).toBe('/evaluate');
  });

  it('uses evaluate when no target exists', () => {
    expect(getSafeRedirect()).toBe('/evaluate');
  });
});
