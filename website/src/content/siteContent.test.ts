import { describe, expect, it } from 'vitest'
import { aiProjects } from './siteContent'

describe('AI project card content', () => {
  it('presents the public automatic compliance platform', () => {
    expect(aiProjects[0]).toMatchObject({
      eyebrow: 'AUTOMATED COMPLIANCE EVALUATION',
      title: '自动合规评判平台',
      description:
        '面向图片材料、法律法规与规章制度，构建可扩展的智能合规评判框架。',
      points: [
        '多类型材料解析',
        '法律法规关联',
        '规章制度对照',
        '结构化评判结果',
      ],
      platform: true,
    })
  })

  it.each(['消防', '公安', '派出所', '天心区'])(
    'does not expose restricted wording: %s',
    (word) => {
      expect(JSON.stringify(aiProjects)).not.toContain(word)
    },
  )
})
