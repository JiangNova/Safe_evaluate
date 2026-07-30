import { describe, expect, it } from 'vitest';
import { platformContent } from './platformContent';

describe('public platform content', () => {
  it('defines the four future workflow areas and keeps evaluation disabled', () => {
    expect(platformContent.inputAreas.map((item) => item.id)).toEqual([
      'images',
      'laws',
      'policies',
      'results',
    ]);
    expect(platformContent.actionEnabled).toBe(false);
    expect(platformContent.status).toBe('功能方案完善中');
  });

  it.each(['公安', '派出所', '天心区', '历史记录', '统计分析', '规则管理'])(
    'does not expose restricted product copy: %s',
    (restrictedText) => {
      expect(JSON.stringify(platformContent)).not.toContain(restrictedText);
    },
  );
});
