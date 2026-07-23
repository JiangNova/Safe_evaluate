# SafeEvaluate 生产环境部署指南（从零到上线）

---

## 第一步：准备工作

1. **注册阿里云账号**并完成实名认证（国内服务器和备案的前提）
2. **准备域名（可选）**：提前买好并实名认证，后面备案需要
3. **获取千问 API Key**：在阿里云 DashScope 控制台创建

---

## 第二步：选购 ECS 服务器

进入云服务器 ECS 购买页，选择"自定义购买"：

| 配置项 | 推荐 |
|--------|------|
| 付费模式 | 长期用选"包年包月"，测试选"按量付费" |
| 地域 | 华东1/华东2（和 DashScope 同区，内网互通更快） |
| 操作系统 | Ubuntu 22.04 或 Alibaba Cloud Linux 3 |
| 实例规格 | 2核4G（经济型 e 实例即可，约 ¥100-200/月） |
| 系统盘 | 40G，高效云盘 |
| 公网 IP | **务必勾选**"分配公网 IPv4 地址" |
| 带宽 | 1-5M 按固定带宽计费 |

> 购买完成后，记下控制台显示的**公网 IP 地址**。

---

## 第三步：服务器初始化

### 3.1 重置密码

ECS 控制台 → 实例列表 → 点击"重置实例密码" → 设置一个强密码。

### 3.2 开放端口（安全组配置）⚠️ 关键步骤

ECS 控制台 → 实例 → 安全组 → 入方向 → 添加规则：

| 端口 | 用途 | 建议 |
|------|------|------|
| 22 | SSH 远程连接 | 授权对象限制为你的 IP |
| 80 | HTTP 网站访问 | 0.0.0.0/0 |
| 443 | HTTPS 加密访问 | 0.0.0.0/0 |

> 后续如果不用 HTTPS，443 可以暂时不开。

---

## 第四步：连接服务器，安装 Docker

```bash
# SSH 登录
ssh root@你的公网IP

# 安装 Docker
curl -fsSL https://get.docker.com | bash
systemctl enable docker
systemctl start docker

# 安装 Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 验证
docker --version
docker-compose --version
```

---

## 第五步：上传项目到服务器

在**本地电脑**上打包：

```powershell
cd d:\myself\Safe_evaluate
tar --exclude='node_modules' --exclude='__pycache__' --exclude='.git' --exclude='backend/data' -czf safe-evaluate.tar.gz .
```

上传：

```powershell
# 上传压缩包
scp safe-evaluate.tar.gz root@你的公网IP:/opt/
```

回到**服务器**上解压：

```bash
cd /opt
mkdir -p safe-evaluate && cd safe-evaluate
tar -xzf ../safe-evaluate.tar.gz

# 确保数据目录存在
mkdir -p backend/data/reports
```

---

## 第六步：配置环境变量

> **注意**：`.env` 文件不在打包里（被 .gitignore 排除了），所以需要在服务器上新建一份。
> 其中 `QWEN_API_KEY` **直接用你本地已有的 Key，不需要重新申请**。
> 需要改的是 JWT 密钥（服务器用新的）和登录账号密码（正式环境用）。

在**服务器**上创建 `.env`：

```bash
cd /opt/safe-evaluate

# 生成随机 JWT 密钥
JWT_SECRET=$(openssl rand -hex 32)

cat > .env << EOF
QWEN_API_KEY=sk-这里填你本地已有的API_Key（不用重新申请）
QWEN_API_BASE=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen-vl-plus

# 备用 API（可选，主通路 key 限流/欠费时自动切换）
# 同样是千问 DashScope，换一个 API Key 即可
BACKUP_API_KEY=sk-这里填你的备用API_Key
BACKUP_API_BASE=https://dashscope.aliyuncs.com/compatible-mode/v1
BACKUP_MODEL=qwen-vl-plus

# 重试次数和间隔
API_MAX_RETRIES=3
API_RETRY_DELAY=1.5

APP_USERS={"你的用户名": "你的密码"}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRY_HOURS=24
CORS_ORIGINS=http://你的公网IP
EOF
```

> **务必修改**：`QWEN_API_KEY`、`APP_USERS`（登录账号密码）、`CORS_ORIGINS`。

---

## 第七步：构建前端并上传

在**本地电脑**上构建：

```powershell
cd d:\myself\Safe_evaluate\frontend
npm install
npm run build
```

上传构建产物到服务器：

```powershell
scp -r frontend/dist root@你的公网IP:/opt/safe-evaluate/frontend/
```

---

## 第八步：启动服务

```bash
cd /opt/safe-evaluate
docker-compose up -d

# 查看容器状态（backend 和 nginx 都应该是 Up）
docker-compose ps

# 查看后端日志确认无报错
docker-compose logs -f backend
```

验证：

```bash
# 后端健康检查
curl http://localhost:8000/api/health

# 前端访问：浏览器打开 http://你的公网IP
# 应该能看到登录页面
```

---

## 第九步：域名解析与备案（国内必须）

### 9.1 ICP 备案

国内服务器必须先备案才能通过域名访问，在阿里云备案平台提交资料，审核一般 3-7 个工作日。

> **备案期间不影响 IP 访问**，可以先通过 `http://公网IP` 测试使用。

### 9.2 域名解析

备案通过后，在域名控制台添加 **A 记录**，将域名指向 ECS 公网 IP。

### 9.3 更新配置

```bash
# 修改 .env 中的 CORS_ORIGINS
CORS_ORIGINS=http://你的域名

# 重启
cd /opt/safe-evaluate
docker-compose down && docker-compose up -d
```

---

## 第十步（可选）：配置 HTTPS

```bash
# 1. 用 acme.sh 申请免费 SSL 证书
curl https://get.acme.sh | sh
~/.acme.sh/acme.sh --issue -d 你的域名.com --nginx

# 2. 安装证书
mkdir -p /opt/safe-evaluate/ssl
~/.acme.sh/acme.sh --install-cert -d 你的域名.com \
    --key-file /opt/safe-evaluate/ssl/key.pem \
    --fullchain-file /opt/safe-evaluate/ssl/cert.pem

# 3. 编辑 docker-compose.yml，取消这两行注释：
#    - "443:443"
#    - ./ssl:/etc/nginx/ssl:ro

# 4. 编辑 nginx.conf，取消 HTTPS server block 注释，
#    把 your-domain.com 改成你的真实域名和证书路径

# 5. 重启
docker-compose down && docker-compose up -d
```

---

## 日常运维

### API 稳定性说明

系统内置了多层容错机制，确保评估服务的稳定性：

| 机制 | 说明 |
|------|------|
| **自动重试** | API 调用失败时，最多重试 3 次（指数退避：1.5s → 2.25s → 3.4s） |
| **备用通路** | 主 API（千问 DashScope）连续失败后，自动切换到备用 API（如 SiliconFlow） |
| **连接池复用** | HTTP 连接池复用，避免频繁握手导致的延迟 |
| **智能错误分类** | 4xx 客户端错误不重试（如 Key 无效），5xx/429/网络错误自动重试 |

> **注意**：如果主通路和备用通路同时失败，系统会返回详细的错误信息，方便排查。

### 更新代码

```bash
# 本地打包
tar -czf update.tar.gz backend/ frontend/dist/ requirement/
scp update.tar.gz root@ECS:/opt/safe-evaluate/

# 服务器上
cd /opt/safe-evaluate
tar -xzf update.tar.gz
docker-compose down && docker-compose up -d --build
```

### 备份数据

```bash
# 每天凌晨 2 点自动备份，保留 30 天
echo '0 2 * * * tar -czf /backup/reports-$(date +\%Y\%m\%d).tar.gz /opt/safe-evaluate/backend/data/ && find /backup/ -mtime +30 -delete' | crontab -
```

### 查看日志

```bash
docker-compose logs -f backend --tail=100
```

---

## 成本参考

| 项目 | 月费用 |
|------|--------|
| ECS 2核4G | ¥100-200 |
| 系统盘 40G | ¥14 |
| 带宽 5Mbps | ¥100-200 |
| 千问 API | ¥0.01-0.05/次 |
| **合计** | **¥200-400/月** |
