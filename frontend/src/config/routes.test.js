import { describe, expect, it } from 'vitest';
import { TIANXIN_BASE, TIANXIN_LOGIN_URL } from './routes';

describe('Tianxin route configuration', () => {
  it('uses the dedicated Tianxin path space', () => {
    expect(TIANXIN_BASE).toBe('/evaluate_tianxin');
    expect(TIANXIN_LOGIN_URL).toBe('/evaluate_tianxin/login');
  });
});
