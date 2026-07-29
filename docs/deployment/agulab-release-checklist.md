# AGULAB 官网与风险评估平台发布清单

> 只有在本地验收完成且用户明确确认“可以更新服务器”后，才能执行本清单。

## 发布目标

- 官网：`/`
- 风险评估平台：`/evaluate`
- 后端 API：`/api/*`
- 数据目录：服务器现有 `backend/data/`，不得覆盖
- 法规目录：服务器现有 `requirement/`，不得覆盖
- 环境配置：服务器现有 `.env`，不得上传替换

## 上线前

- [ ] 记录目标主机、当前提交和容器状态。
- [ ] 确认当前 `/evaluate` 可访问。
- [ ] 确认当前 `/api/health` 返回 HTTP 200。
- [ ] 记录现有报告数量，并抽查一份报告和图片。
- [ ] 备份当前代码、`nginx.conf`、`docker-compose.yml`。
- [ ] 备份 `.env`、`backend/data/`、`requirement/`。
- [ ] 备份当前 `frontend/dist/`；若已有官网，同时备份 `website/dist/`。
- [ ] 本地双前端构建、单元测试、Nginx 路由测试和浏览器验收全部通过。

## 发布后

- [ ] `/` 返回 AGULAB 官网。
- [ ] `/about` 可直接打开并刷新。
- [ ] `/evaluate` 未登录时进入 `/login`。
- [ ] 登录后返回原目标路径。
- [ ] `/history`、`/rules`、`/stats` 可用。
- [ ] 打开一份真实 `/report/<id>`，报告与图片完整。
- [ ] `/api/health` 返回 HTTP 200。
- [ ] 新建一次测试评估，确认数据可以写入。
- [ ] 检查 Nginx 和后端最近 100 行日志。

## 安全边界

- 发布包不得包含 `.env`、账号、密码、API Key、JWT 密钥或私钥。
- 不得删除、重建或清空 `backend/data/` 与 `requirement/`。
- 不得在未完成备份时覆盖现有 Nginx、Compose 或前端构建产物。
