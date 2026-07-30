# AGULAB 官网与 SafeEvaluate 整合设计

日期：2026-07-29

状态：会话内方案已确认，待书面规格复核

## 1. 目标

在不破坏现有 SafeEvaluate 风险评估功能、用户数据和部署能力的前提下，将 AGULAB 实验室官网与风险评估平台部署在同一个服务器和同一个域名下。

上线后的公开路径：

```text
/                    AGULAB 实验室官网
/evaluate            风险评估入口
/login               平台登录
/history             历史报告
/report/:id          报告详情
/rules               规则管理
/stats               统计页面
/api/*               FastAPI 接口
```

未登录用户访问 `/evaluate` 时进入 `/login`，登录成功后返回 `/evaluate`。后续启用域名时仅替换主机名，路径保持不变。

## 2. 不在本轮执行的事项

- 未经用户最终确认，不更新线上服务器。
- 不读取、复制或提交本地 `.env`。
- 不删除、重建或迁移现有 `backend/data`。
- 不修改现有报告、图片、数据库和法规文档内容。
- 不把两个 React 应用合并为一个前端工程。
- 不使用 iframe 嵌入风险评估平台。
- 不更改风险评估业务逻辑和 AI 评估流程。

## 3. 目录结构

整合后的仓库结构：

```text
Safe_evaluate/
├─ website/                 # AGULAB 官网，独立 React/Vite 工程
├─ frontend/                # SafeEvaluate 平台前端
├─ backend/                 # FastAPI 后端
├─ requirement/             # 评估依据文档
├─ backend/data/            # 数据库、报告和图片，持久化保留
├─ docs/
├─ docker-compose.yml
├─ Dockerfile
├─ nginx.conf
├─ .env                     # 仅本地和服务器保存
└─ .env.example
```

`website/` 和 `frontend/` 独立安装依赖、构建和维护。两者不得共享 `node_modules`，也不得相互导入组件。

## 4. 前端边界

### 4.1 AGULAB 官网

官网负责：

- 实验室品牌与研究方向展示；
- 自动驾驶赛车与 AI 赋能内容；
- 合作共赢与联系方式；
- 引导用户进入风险评估平台。

官网按钮使用普通站内链接 `/evaluate`。官网不读取登录状态，也不直接调用评估 API。

### 4.2 SafeEvaluate 平台

平台继续负责：

- 登录和 JWT 认证；
- 新建评估；
- 上传图片与 PDF；
- 风险评估；
- 报告、历史记录、规则和统计。

平台保留现有根级路由。访问受保护路由但没有有效登录状态时跳转 `/login`。登录成功后应返回原目标路径；若没有记录目标路径，则默认进入 `/evaluate`。

## 5. 静态资源隔离

两个 Vite 应用默认都会生成 `/assets/*`，直接共同部署会发生冲突。

采用以下隔离：

```text
/website-static/*     AGULAB 官网构建资源
/assets/*             SafeEvaluate 平台现有构建资源
```

AGULAB 官网 Vite 配置使用：

```text
base: /website-static/
```

官网构建产物中的 JavaScript、CSS、图片和字体均从 `/website-static/` 加载。官网页面本身仍通过 `/`、`/about` 等公开路径访问，不暴露构建目录概念。

SafeEvaluate 前端保持当前 `/assets/*` 资源路径，减少对现有应用的改动。

## 6. Nginx 路由

Nginx 同时挂载两个构建目录：

```text
/usr/share/nginx/website     AGULAB 官网 dist
/usr/share/nginx/platform    SafeEvaluate frontend/dist
```

请求分发规则按优先级排列：

1. `/api/*` 反向代理至 FastAPI；
2. `/assets/*` 从 SafeEvaluate 平台构建目录读取；
3. `/website-static/*` 从 AGULAB 官网构建目录读取；
4. `/login`、`/evaluate`、`/history`、`/report/*`、`/rules`、`/stats` 回退至平台 `index.html`；
5. `/` 与官网栏目路径回退至官网 `index.html`；
6. 其他未知路径由官网显示 404，不进入风险评估平台。

Nginx 继续保留：

- 上传大小限制；
- API 长耗时超时配置；
- 转发客户端地址和协议头；
- SPA 路由回退；
- 静态资源长期缓存。

HTML 文件不使用长期不可变缓存，避免部署后仍读取旧入口文件。

## 7. Docker Compose

Nginx 服务增加官网构建目录挂载：

```text
./website/dist:/usr/share/nginx/website:ro
./frontend/dist:/usr/share/nginx/platform:ro
```

FastAPI 服务、`backend/data` 持久化、`requirement` 只读挂载和环境变量来源保持不变。

Docker 镜像不复制 `.env`、`backend/data`、本地虚拟环境或前端 `node_modules`。

## 8. 本地开发

本地使用三个进程：

```text
AGULAB 官网             127.0.0.1:5173
SafeEvaluate 前端       127.0.0.1:3000
FastAPI 后端            127.0.0.1:8000
```

官网开发环境中的 `/evaluate` 需要明确指向平台开发地址，或使用本地开发代理入口。生产构建中链接保持 `/evaluate`。

平台 Vite 继续代理 `/api` 至 `127.0.0.1:8000`。

最终上线前使用本地 Nginx 或 Docker Compose 验证与生产一致的同域路径。

## 9. 安全整改

公开挂接官网前完成：

- 服务器 `.env` 使用随机 JWT 密钥；
- 服务器 `.env` 使用非默认账号和强密码；
- 删除代码与 Compose 中可预测的生产回退账号；
- JWT 密钥缺失时生产环境应拒绝启动，不使用固定默认值；
- CORS 仅允许实际 IP 或域名；
- `.env`、日志、数据库、报告、图片和部署压缩包不得进入 Git；
- 清理或隔离仓库中的旧部署压缩包；
- 确认报告图片接口继续要求认证；
- 确认 Nginx 不允许直接浏览 `backend/data`。

本轮不在聊天或提交记录中输出任何真实密钥、账号密码或服务器私钥。

## 10. 数据保护

线上更新前单独备份：

```text
.env
backend/data/reports.db
backend/data/reports/
backend/data/images/
backend/data/eval_images/
requirement/
当前 docker-compose.yml
当前 nginx.conf
当前前后端构建与源码包
```

部署更新不得使用会覆盖或删除 `backend/data` 的命令。数据库结构发生变化时必须先制作数据库副本，并提供可逆迁移。

## 11. 验收

### 11.1 官网

- `/` 显示 AGULAB 首页；
- 首屏、导航和响应式布局正常；
- 官网栏目路由刷新后仍能打开；
- “进入风险评估平台”进入 `/evaluate`；
- 官网静态资源没有 404。

### 11.2 平台

- `/evaluate` 未登录时进入 `/login`；
- 登录成功后进入 `/evaluate`；
- 新建评估、文件上传和长耗时请求正常；
- `/history`、`/report/:id`、`/rules`、`/stats` 正常；
- 页面刷新不会返回官网或 Nginx 404；
- 平台静态资源没有 404。

### 11.3 后端与数据

- `/api/health` 正常；
- 现有历史报告数量不减少；
- 现有报告图片可查看；
- 新评估可以写入数据库和持久化目录；
- 容器重启后数据仍存在。

### 11.4 安全

- 未认证 API 返回 401；
- `.env` 和数据文件不能通过 HTTP 访问；
- 生产依赖无已知高危漏洞；
- 浏览器控制台无错误；
- Nginx 日志无持续 404 或代理错误。

## 12. 部署与回滚

部署分为两个阶段：

### 阶段一：本地整合

1. 保留 SafeEvaluate 当前未提交修改；
2. 新增 `website/`；
3. 调整构建、Nginx 和 Compose；
4. 本地构建两个前端；
5. 本地 Docker 验证完整路径；
6. 用户浏览器确认。

### 阶段二：用户批准后上线

1. 备份服务器代码、配置和数据；
2. 记录当前容器镜像与部署目录；
3. 上传新构建和配置；
4. 重新构建并启动容器；
5. 执行完整验收；
6. 验收通过后保留旧版本一段时间；
7. 任一关键检查失败时立即恢复旧配置和构建。

上线属于独立操作，必须在用户明确确认“可以更新服务器”之后执行。
