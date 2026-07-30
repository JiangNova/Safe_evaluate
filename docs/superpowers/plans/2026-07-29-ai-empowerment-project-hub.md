# AI Empowerment Project Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the fire-safety risk evaluation entry out of the homepage hero and into a scalable AI empowerment project hub.

**Architecture:** Add a dedicated React page for `/ai-empowerment`, backed by typed content arrays for capabilities and projects. Keep platform URL generation in the existing `getPlatformUrl()` helper and let `App.tsx` select the new page while preserving placeholder routing for unfinished pages.

**Tech Stack:** React 19, TypeScript, Vite, CSS Modules, Vitest

## Global Constraints

- Preserve the existing AGULAB navy, warm-yellow, off-white visual system.
- Do not add a second fictional project or a new top-level product navigation item.
- Do not modify the SafeEvaluate platform application or its authentication flow.
- Keep the production platform URL at `/evaluate` through `getPlatformUrl()`.
- Support desktop grid and mobile single-column layouts.

---

### Task 1: Route and Homepage Hierarchy

**Files:**
- Modify: `website/src/components/DualSceneHero.tsx`
- Modify: `website/src/pages/HomePage.tsx`
- Modify: `website/src/pages/HomePage.module.css`
- Modify: `website/src/App.tsx`
- Test: `website/src/App.test.tsx`

**Interfaces:**
- Consumes: `AiEmpowermentPage` default-free named export from `./pages/AiEmpowermentPage`.
- Produces: `/ai-empowerment` route rendering the real page; homepage no longer renders direct platform links.

- [ ] **Step 1: Write the failing route-source test**

```tsx
import { describe, expect, it } from 'vitest'
import appSource from './App.tsx?raw'
import heroSource from './components/DualSceneHero.tsx?raw'
import homeSource from './pages/HomePage.tsx?raw'

describe('AI empowerment routing', () => {
  it('uses the dedicated AI empowerment page', () => {
    expect(appSource).toContain("import { AiEmpowermentPage }")
    expect(appSource).toContain("pathname === '/ai-empowerment'")
  })

  it('keeps the platform entry out of homepage surfaces', () => {
    expect(heroSource).not.toContain('getPlatformUrl')
    expect(homeSource).not.toContain('getPlatformUrl')
  })
})
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- --run src/App.test.tsx`

Expected: FAIL because the page import and route do not exist and homepage sources still reference `getPlatformUrl`.

- [ ] **Step 3: Remove the hero and research-card platform links**

Remove the `getPlatformUrl` imports and the two direct `<a>` entries. Remove the now-unused `.platformEntry` CSS rules.

- [ ] **Step 4: Register the dedicated page**

Import `AiEmpowermentPage` in `App.tsx`, then select it before the generic `currentPage` placeholder:

```tsx
if (pathname === '/') {
  page = <HomePage />
} else if (pathname === '/ai-empowerment') {
  page = <AiEmpowermentPage />
} else if (currentPage) {
  // existing placeholder
}
```

- [ ] **Step 5: Run the focused test**

Run: `npm test -- --run src/App.test.tsx`

Expected: PASS.

### Task 2: Typed AI Project Content

**Files:**
- Modify: `website/src/content/siteContent.ts`

**Interfaces:**
- Produces: `aiCapabilities` and `aiProjects` readonly arrays.
- `aiProjects[0].platform` is `true`; its route is supplied by `getPlatformUrl()` at render time rather than stored as an environment-specific URL.

- [ ] **Step 1: Add capability content**

Add four capability objects with `code`, `title`, and `description`: multimodal perception, industry knowledge, intelligent reporting, and decision assistance.

- [ ] **Step 2: Add the first project record**

```ts
export const aiProjects = [
  {
    index: '01',
    status: '可在线体验',
    eyebrow: 'Fire Safety Intelligence',
    title: '消防安全风险评估',
    description: '上传消防现场照片或图纸，结合检查依据识别风险，并生成结构化评估结果与检查文书。',
    points: ['多图与图纸分析', '消防风险识别', '法规依据关联', '评估报告与检查文书生成'],
    platform: true,
  },
] as const
```

- [ ] **Step 3: Type-check the content**

Run: `npm run build`

Expected: Existing build remains successful before the new page consumes these exports.

### Task 3: AI Empowerment Page

**Files:**
- Create: `website/src/pages/AiEmpowermentPage.tsx`
- Create: `website/src/pages/AiEmpowermentPage.module.css`

**Interfaces:**
- Consumes: `aiCapabilities`, `aiProjects`, and `getPlatformUrl()`.
- Produces: named React component `AiEmpowermentPage`.

- [ ] **Step 1: Build the semantic page structure**

Create a `<main id="main-content">` containing:

- a direction hero with eyebrow, `h1`, summary, and link to `#projects`;
- a four-item capability section;
- an `id="projects"` application-project section;
- an `<article>` for each `aiProjects` item;
- a real `<a href={getPlatformUrl()}>立即体验</a>` for platform projects;
- a final note stating that more industry projects will be added as they are validated.

- [ ] **Step 2: Add page styling**

Implement a navy hero, off-white capabilities grid, and warm-yellow highlighted project card. Include visible `:focus-visible` states, `scroll-margin-top` on `#projects`, a two-column desktop layout, and single-column breakpoints at `900px` and `640px`.

- [ ] **Step 3: Run unit tests**

Run: `npm test -- --run`

Expected: All Vitest tests pass.

- [ ] **Step 4: Run production build**

Run: `npm run build`

Expected: TypeScript and Vite build complete without errors.

### Task 4: Browser Verification

**Files:**
- Create: `output/playwright/ai-hub-home-desktop.png`
- Create: `output/playwright/ai-hub-page-desktop.png`
- Create: `output/playwright/ai-hub-page-mobile.png`

**Interfaces:**
- Consumes: integrated local preview and built `website/dist`.
- Produces: visual evidence for homepage hierarchy and responsive project page.

- [ ] **Step 1: Start the integrated preview**

Run: `python scripts/serve-integration.py --port 8765`

Expected: Local preview listens on `127.0.0.1:8765`.

- [ ] **Step 2: Verify the homepage**

Open `/`, snapshot the DOM, and confirm the hero has only “探索自动驾驶赛车”, “了解AI赋能方案”, and “合作共赢”; confirm no “进入风险评估平台” text appears on the homepage.

- [ ] **Step 3: Verify the AI page**

Open `/ai-empowerment`, confirm the project card and “立即体验” link exist, and confirm the link target resolves to `/evaluate` in the production build.

- [ ] **Step 4: Capture desktop and mobile screenshots**

Capture the homepage and AI page at a desktop viewport, then capture the AI page at a mobile viewport near `390 × 844`. Inspect all screenshots for overflow, broken wrapping, missing assets, and incorrect page state.

- [ ] **Step 5: Review repository changes**

Run: `git diff --check` and `git status --short`.

Expected: No whitespace errors; unrelated pre-existing SafeEvaluate changes remain untouched.
