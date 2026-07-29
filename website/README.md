# AGULAB Website

AGULAB 实验室官方网站。第一阶段实现首页与全站栏目预告页面，聚焦自动驾驶赛车、极限自主智能和 AI 行业赋能。

## 本地运行

```bash
npm install
npm run dev
```

开发服务器默认运行在 `http://localhost:5173`。

## 验证

```bash
npm run lint
npm run build
npm audit
```

## 内容与结构

- 页面文字和栏目配置：`src/content/siteContent.ts`
- 首页：`src/pages/HomePage.tsx`
- 双场景首屏：`src/components/DualSceneHero.tsx`
- 全局样式：`src/styles/global.css`
- 设计规格：`docs/superpowers/specs/2026-07-29-agulab-website-design.md`
- 实施计划：`docs/superpowers/plans/2026-07-29-agulab-homepage-implementation.md`
