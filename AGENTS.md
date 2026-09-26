# AGENTS Guide

## 项目概览

- 项目类型：Next.js App Router 静态导出站点壳 + `ALCHE` 视觉复刻程序
- 当前主目标：`ALCHE visual reproduction`
- 当前活跃程序：`kv -> works_intro -> works -> works_cards`
- 部署目标：GitHub Pages，子路径 `/CVWebsite/`
- 当前运行模式：`kv-works`
- 参考 authority：`Task/参考视频.mp4` -> `data/alche-works-shotbook.json` -> 新鲜本地/远端截图
- 2026-07-13 起：kv->works 段切换为参考准确的暗色 LED 方向;service/stellla/outro 已并入滚动轨道(shell DOM 实现);最新 handoff 见 `docs/handoff/alche-top-page-handoff-2026-07-13.md`
- 支持语言：`en`、`zh-CN`、`ja`、`ko`

## 技术栈

- Next.js
- React
- TypeScript 严格模式
- Tailwind CSS
- Motion

建议与 CI 对齐：

- Node 20+

## 目录地图

- `app/`
  App Router 路由入口。`app/page.tsx` 是语言网关，`app/[locale]/page.tsx` 当前直接进入 `AlcheTopPageShell`。

- `components/`
  当前活跃入口集中在 `components/alche-top-page/*`。这是单一 Three/R3F Canvas 的真实渲染链。

- `sections/`
  旧的 portfolio 区块实现仍在仓库中，但不是当前主路由的活跃首页路径。

- `data/`
  当前最重要的是 `data/alche-works-shotbook.json`。旧的 portfolio 内容数据仍保留，但不是当前主线 authority。

- `lib/`
  包含 `basePath` 工具、语言逻辑，以及当前 `ALCHE` runtime/shotbook helper。

- `styles/`
  全局 theme token。

- `public/`
  dossier 资源、Abyss hero 图层、氛围粒子、项目封面与示意图等可替换资源。

- `scripts/`
  构建后静态导出校验、Playwright 验证与本地链接检查。

- `.github/workflows/deploy.yml`
  GitHub Pages 静态导出部署流程。

## 关键运行命令

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
npm run verify:static
npm run verify:links
```

本地开发地址：

```bash
http://localhost:3000/CVWebsite
```

## 关键约束

### 1. 不能破坏 GitHub Pages 子路径

`next.config.mjs` 固定包含：

- `output: "export"`
- `basePath: "/CVWebsite"`
- `trailingSlash: true`
- `images.unoptimized: true`

这意味着：

- 页面导航优先用 `next/link`
- 直接引用 `public/` 资源时，需要通过 [`lib/site.ts`](/mnt/d/Project/AIProject/MyProject/CVWebsite/lib/site.ts) 的 `assetPath()` 处理
- 不要把视频、PDF、原生 `<img>`、下载链接直接写成 `/resume/...` 这种裸根路径

### 2. 保持静态导出兼容

除非用户明确要求，否则不要引入：

- SSR 依赖
- 动态服务端 API
- middleware 级别语言重写
- 数据库
- CMS
- 表单后端

根路径语言跳转是客户端实现，不是服务端重定向。

### 3. 内容必须集中在 `data/`

以下类型内容不要散落在组件里：

- 多语言文案
- 项目卡内容
- 联系方式
- 简历资源路径

优先编辑：

- 当前 `ALCHE` 主线优先：
  - [`data/alche-works-shotbook.json`](/mnt/d/Project/AIProject/MyProject/CVWebsite/data/alche-works-shotbook.json)
  - [`lib/alche-works-shotbook.ts`](/mnt/d/Project/AIProject/MyProject/CVWebsite/lib/alche-works-shotbook.ts)
  - [`data/alche-top-page.ts`](/mnt/d/Project/AIProject/MyProject/CVWebsite/data/alche-top-page.ts)
- 旧的 portfolio 内容数据次之：
  - [`data/dictionaries.ts`](/mnt/d/Project/AIProject/MyProject/CVWebsite/data/dictionaries.ts)
  - [`data/artifacts.ts`](/mnt/d/Project/AIProject/MyProject/CVWebsite/data/artifacts.ts)
  - [`data/profile.ts`](/mnt/d/Project/AIProject/MyProject/CVWebsite/data/profile.ts)

### 4. 多语言结构必须保持完整

固定语言集合：

- `en`
- `zh-CN`
- `ja`
- `ko`

新增或修改区块文案时，4 个语言必须一起补齐，不允许只改英文。

### 5. 当前视觉程序边界

当前不要再把首页当成传统 DOM hero 或旧 portfolio 首屏来改。

允许：

- reveal
- shotbook 驱动的 section choreography
- 单一 Canvas 内的圆弧轨迹、径向朝向、桌面宽高比补偿
- named shot 与 free-scroll 双验证

不允许默认引入：

- 把当前问题误诊成 portfolio 内容层问题
- 重新打开 `full-chain` parity
- 把 side-lane 距离问题优先归因到全局 `baseRadius`
- 只用 `alcheShot` 成功就宣称 free-scroll 正确
- 缺远端截图证据就宣称 GitHub Pages 已对齐

当前首页是单一 Three/R3F Canvas：

- 墙体
- 中心模型
- works cards
- DOM shell 只负责语言、header、section 与 debug UI

继续沿着这个方向迭代，不要默认把首页重新改回旧的 `Ashen Archive` 首页结构。

### 6. 无障碍要求

必须保留：

- `prefers-reduced-motion`
- 键盘可操作的作品弹层
- 键盘可操作的小游戏
- 语义化标题层级
- 可聚焦 CTA

## 内容维护指引

当前主线不是“补 portfolio 内容”，而是“提高 `ALCHE visual reproduction` 的 shot parity”。

高优先级入口：

- handoff：
  [`docs/handoff/alche-top-page-handoff-2026-04-29.md`](/mnt/d/Project/AIProject/MyProject/CVWebsite/docs/handoff/alche-top-page-handoff-2026-04-29.md)
- visual loop：
  [`docs/alche-cards-visual-loop.md`](/mnt/d/Project/AIProject/MyProject/CVWebsite/docs/alche-cards-visual-loop.md)
- skill：
  [`.codex/skills/alche-works-visual-loop/SKILL.md`](/mnt/d/Project/AIProject/MyProject/CVWebsite/.codex/skills/alche-works-visual-loop/SKILL.md)
- experience：
  [`docs/experience/alche-works-maintenance-lessons.md`](/mnt/d/Project/AIProject/MyProject/CVWebsite/docs/experience/alche-works-maintenance-lessons.md)

最常替换的位置：

- dossier PDF：
  [`public/resume`](/mnt/d/Project/AIProject/MyProject/CVWebsite/public/resume)

- Hero / 氛围素材：
  [`public/hero`](/mnt/d/Project/AIProject/MyProject/CVWebsite/public/hero)
  [`public/atmosphere`](/mnt/d/Project/AIProject/MyProject/CVWebsite/public/atmosphere)

- 项目封面与示意图：
  [`public/artifacts`](/mnt/d/Project/AIProject/MyProject/CVWebsite/public/artifacts)

- 联系方式与简历下载路径：
  [`data/profile.ts`](/mnt/d/Project/AIProject/MyProject/CVWebsite/data/profile.ts)

- 项目内容：
  [`data/artifacts.ts`](/mnt/d/Project/AIProject/MyProject/CVWebsite/data/artifacts.ts)

- 场景图层与粒子参数：
  [`data/atmosphere.ts`](/mnt/d/Project/AIProject/MyProject/CVWebsite/data/atmosphere.ts)

如果用户要求“补全真实内容”，先确认他要的是：

- `ALCHE reproduction` 主线
- 还是旧 portfolio 内容

不要在两套目标之间来回混改。

## 验证建议

当前 `ALCHE` 主线推荐验证顺序：

```bash
npm run build
npm run typecheck
npm run verify:static
npm run validate:playwright
```

改资源路径或 basePath 相关逻辑后，额外执行：

```bash
npm run verify:links
```

## 当前已知事实

- 根路径 `/CVWebsite/` 会先读本地语言记忆，再读浏览器语言
- 主路由 `/{locale}/` 当前进入 [`AlcheTopPageShell`](/mnt/d/Project/AIProject/MyProject/CVWebsite/components/alche-top-page/alche-top-page-shell.tsx)
- 当前运行模式是 `kv-works`
- 当前 authority 不是旧 portfolio 文案，而是参考视频、shotbook 与新鲜截图
- `worksCardsProgress` 已独立于 `activeSection`
- `alcheShot` 是命名状态诊断入口，`alcheCardDebug=identity|poster` 已接入
- 当前主线的目标是 `ALCHE visual reproduction`，不是旧的 `Ashen Archive` 首页优化
