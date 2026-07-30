# Generic Project Card Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fire-safety-specific AI project card with neutral automatic compliance evaluation copy.

**Architecture:** Keep the existing data-driven `AiEmpowermentPage` unchanged. Update only the `aiProjects` content model and add a focused content-boundary test.

**Tech Stack:** TypeScript, React 19, Vitest 4, Vite 8.

## Global Constraints

- Keep the project action linked to `/evaluate`.
- Do not change the Tianxin platform.
- Do not change page layout, colors, or interaction.
- The project card must not contain `消防`, `公安`, `派出所`, or `天心区`.
- Preserve unrelated working-tree changes in `debug_ai_response.txt` and `frontend/src/pages/history/*`.

---

### Task 1: Replace and Verify the Project Card Copy

**Files:**
- Create: `website/src/content/siteContent.test.ts`
- Modify: `website/src/content/siteContent.ts`

**Interfaces:**
- Consumes: exported `aiProjects` content array.
- Produces: one public project named `自动合规评判平台` with four neutral capability points.

- [ ] **Step 1: Write the failing content test**

```ts
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
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```powershell
cd website
npm test -- --run src/content/siteContent.test.ts
```

Expected: FAIL because the existing card title is `消防安全风险评估`.

- [ ] **Step 3: Replace the project content**

Set the first `aiProjects` entry to:

```ts
{
  index: '01',
  status: '可在线体验',
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
}
```

- [ ] **Step 4: Run website verification**

Run:

```powershell
cd website
npm test -- --run
npm run lint
npm run build
```

Expected: all tests and lint pass; production build succeeds.

- [ ] **Step 5: Inspect the project card**

Open `/ai-empowerment` through the integrated preview. Confirm the new title and four capability points render without overflow, the old fire-safety wording is absent from the project card, and the action still links to `/evaluate`.

- [ ] **Step 6: Commit**

```powershell
git add website/src/content/siteContent.ts website/src/content/siteContent.test.ts
git commit -m "fix: generalize evaluation project card"
```
