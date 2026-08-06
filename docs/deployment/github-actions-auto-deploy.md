# GitHub Actions 自动部署配置

本项目在 GitHub 仓库的 `main` 分支收到新提交时，会自动构建四个前端、测试发布脚本、上传发布包并更新生产服务器。普通维护者不需要登录服务器。

> 自动部署只在变更进入 `main` 后发生。老师推送个人分支或创建 PR 不会更新生产服务器；PR 被审核并合并到 `main` 后才会发布。

## 0. 先保护 `main` 分支

在 GitHub 仓库依次打开 **Settings → Rules → Rulesets**（或 **Branch protection rules**），为 `main` 设置：

1. 要求通过 Pull Request 合并；
2. 至少需要 1 位审批人；
3. 禁止直接推送到 `main`，只允许你或指定管理员合并；
4. 建议要求合并前分支为最新状态。

部署工作流会在 `main` 上运行服务器脚本。因此，拥有直接合并权限的人应被视为拥有生产发布权限。请不要把直接推送或合并 `main` 的权限普遍授予协作者。

## 1. 一次性准备服务器

以下命令在生产服务器上以 `root` 或可使用 `sudo` 的管理员身份运行。假定项目已部署在 `/opt/safe-evaluate` 且 Docker Compose 可以正常启动现有服务。

```bash
adduser --disabled-password --gecos '' deployer
usermod -aG docker deployer

install -d -m 700 -o deployer -g deployer /home/deployer/.ssh
install -d -m 750 -o deployer -g deployer /opt/safe-evaluate-backups

# 仅授予发布脚本需要替换的代码和前端目录写权限；保留 data、requirement、ssl。
chown deployer:deployer /opt/safe-evaluate/backend
find /opt/safe-evaluate/backend -mindepth 1 -maxdepth 1 ! -name data -exec chown -R deployer:deployer {} +
chown -R deployer:deployer \
  /opt/safe-evaluate/frontend \
  /opt/safe-evaluate/frontend-public \
  /opt/safe-evaluate/frontend-leadership \
  /opt/safe-evaluate/website
chown deployer:deployer /opt/safe-evaluate/nginx.conf /opt/safe-evaluate/docker-compose.yml

# Docker Compose 必须读取 .env；保持 root 所有者，但只给 deployer 组读取权限。
chown root:deployer /opt/safe-evaluate/.env
chmod 640 /opt/safe-evaluate/.env
```

`deployer` 需要读取项目的服务器端 `.env`，因为 Docker Compose 启动时会读取它；加入 `docker` 组也具有很高的服务器权限。因此，这个账户的私钥只能存放在 GitHub Secrets，不能发送到群聊、提交到仓库或保存在普通开发电脑上。

在你的管理电脑上生成一对仅供 GitHub Actions 使用的密钥：

```bash
ssh-keygen -t ed25519 -f safe-evaluate-github-deploy -C github-actions-deploy
```

将生成的 `safe-evaluate-github-deploy.pub` 内容添加到服务器：

```bash
touch /home/deployer/.ssh/authorized_keys
chmod 600 /home/deployer/.ssh/authorized_keys
cat safe-evaluate-github-deploy.pub >> /home/deployer/.ssh/authorized_keys
chown deployer:deployer /home/deployer/.ssh/authorized_keys
```

第二段命令中的公钥文件需先安全传到服务器，或由管理员复制粘贴公钥的单行内容。只上传 `.pub` 公钥；绝不能把没有 `.pub` 后缀的私钥复制到服务器。

确认部署账户能登录并能读取部署目录：

```bash
ssh deployer@YOUR_SERVER_HOST 'cd /opt/safe-evaluate && docker compose ps'
```

如果服务器仍使用旧版 Compose，请将上面命令中的 `docker compose` 改为 `docker-compose`。部署脚本两种形式都支持。

## 2. 验证服务器身份并配置 GitHub Secrets

先在服务器的可信控制台查看 SSH Ed25519 主机密钥指纹：

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

在管理电脑上取得待写入 GitHub 的 known-hosts 行，并与上一步的指纹核对后再使用：

```bash
ssh-keyscan -p YOUR_SSH_PORT -t ed25519 YOUR_SERVER_HOST
```

在仓库中打开 **Settings → Secrets and variables → Actions → New repository secret**，创建以下五项：

| Secret 名称 | 填写内容 |
| --- | --- |
| `DEPLOY_HOST` | 服务器公网 IP 或域名，不含 `https://` |
| `DEPLOY_USER` | `deployer` |
| `DEPLOY_PORT` | SSH 端口；默认 22 时也建议显式填写 `22` |
| `DEPLOY_SSH_KEY` | `safe-evaluate-github-deploy` 私钥的完整内容（不是 `.pub`） |
| `DEPLOY_KNOWN_HOSTS` | 与可信指纹核对后的 `ssh-keyscan` 完整输出 |

不要把 `QWEN_API_KEY`、`JWT_SECRET`、应用用户密码、`.env` 内容或报告数据放进 GitHub Secrets。它们继续仅保留在服务器的 `.env` 和 `backend/data/` 中。

## 3. 第一次发布

先完成前两节，再将包含 `.github/workflows/deploy-production.yml` 的变更合并到 `main`。合并后：

1. 打开 GitHub 仓库的 **Actions → Deploy production**；
2. 等待四个前端构建、测试、上传和服务器健康检查全部变绿；
3. 在浏览器检查 `https://YOUR_DOMAIN/`、`/evaluate`、`/leader-assistant/` 和 `/evaluate_tianxin`；
4. 在服务器检查：

```bash
cd /opt/safe-evaluate
cat .last-deployed-revision
docker compose ps
curl --fail http://127.0.0.1:8000/api/health
```

确认一份已有报告及其图片仍可查看。自动发布包不会包含或覆盖 `.env`、`backend/data/`、`requirement/` 和 `ssl/`。

如需重新发布 `main` 当前版本，打开 **Actions → Deploy production → Run workflow**，并选择 `main` 分支。手动从其他分支运行时，部署任务会跳过，不会更新服务器。

## 4. 自动回滚与排错

每次发布前，脚本会将可替换的后端代码、前端构建产物、`nginx.conf` 和 `docker-compose.yml` 备份到：

```text
/opt/safe-evaluate-backups/<UTC 时间>-<Git SHA>/payload.tar.gz
```

发布后 API 健康检查在 12 次重试内仍失败时，脚本会自动恢复刚才的备份并再次启动旧版本容器。常用排查命令：

```bash
cd /opt/safe-evaluate
docker compose ps
docker compose logs --tail=100 backend
docker compose logs --tail=100 nginx
cat .last-deployed-revision
ls -lah /opt/safe-evaluate-backups
```

如果自动回滚本身失败，停止继续发布，保留日志和备份目录，并由服务器管理员处理。任何回滚操作都不得删除、清空或从备份覆盖 `backend/data/`、`.env`、`requirement/` 或 `ssl/`。

## 日常协作方式

```text
老师创建分支并提交代码 → 创建 PR → 你审核并合并 main → GitHub 自动部署
```

合并后的工作流结果就是发布记录。构建失败时，工作流在连接服务器之前停止；服务器部署或健康检查失败时，脚本自动回滚到发布前版本。
