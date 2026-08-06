# GitHub Actions 自动部署设计

## 目标

当已通过审查的变更合并到 `main` 分支时，GitHub Actions 自动构建、发布并验证 SafeEvaluate 的生产环境。维护者不需要日常登录服务器或输入服务器密码。

工作流也提供手动触发入口，用于重新发布当前 `main` 的指定提交。

## 采用方案

采用“GitHub 构建并通过 SSH 上传部署包”的方案，而不是让服务器执行 `git pull`。服务器不保存 GitHub 仓库凭据；GitHub 只向服务器上传已构建、已验证的发布包。

## 触发与并发控制

- 在推送到 `main` 时自动运行；正常情况下，此推送来自 PR 合并。
- 支持 `workflow_dispatch` 手动运行。
- 同一生产环境只能存在一个部署任务。新的任务会等待正在进行的部署完成，避免发布包交叉覆盖。

## 构建与发布内容

工作流在受控的 Ubuntu Runner 中安装 Node.js 和项目锁定的依赖，依次构建并运行以下前端的既有质量检查：

- `website`
- `frontend-public`
- `frontend-leadership`
- `frontend`

构建成功后，工作流打包后端代码、四个前端的 `dist` 产物、`nginx.conf` 和 `docker-compose.yml`。发布包不得包含或覆盖：

- `.env`
- `backend/data/`
- `requirement/`
- `ssl/`

## 服务器端部署

服务器上的专用 `deployer` 账户仅负责运行部署脚本与 Docker Compose。发布脚本将在部署目录中：

1. 保存当前可部署文件的时间戳备份；
2. 解压新包，且不触碰持久化数据和机密配置；
3. 运行 `docker compose up -d --build`；
4. 等待并检查 `http://127.0.0.1:8000/api/health`；
5. 失败时恢复刚才的备份、重建旧版本，并以失败状态退出。

部署服务的运行目录保持为 `/opt/safe-evaluate`。`backend/data/`、`requirement/`、`.env` 和 `ssl/` 始终由服务器管理员管理。

## GitHub Secrets

工作流只从 GitHub Secrets 读取以下连接信息：

- `DEPLOY_HOST`：服务器公网 IP 或域名。
- `DEPLOY_USER`：专用部署账户名，默认建议为 `deployer`。
- `DEPLOY_PORT`：SSH 端口；未设置时使用 22。
- `DEPLOY_SSH_KEY`：部署账户的专用 SSH 私钥。
- `DEPLOY_KNOWN_HOSTS`：服务器 SSH 主机指纹，防止连接到被冒充的服务器。

API Key、JWT 密钥、应用账号和数据库/报告数据均不作为 GitHub Secret 使用，因为它们不应离开服务器的 `.env` 或持久化目录。

## 失败处理与可见性

GitHub Actions 页面显示构建、上传、部署和健康检查的结果。构建失败时不会触达服务器；部署或健康检查失败时，脚本回滚至部署前版本。维护者据此决定修复后再次合并，或通过手动入口重新发布。

## 首次配置边界

首次配置需要管理员在服务器上创建 `deployer` 账户、安装其 SSH 公钥并授予受限 Docker 操作权限；随后将对应的私钥和主机指纹写入 GitHub Secrets。完成一次性配置后，常规发布无需密码输入或服务器交互。
