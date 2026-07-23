# SafeEvaluate 生产环境部署指南

## 推荐方案：阿里云 ECS + Docker Compose

### 为什么选这个

| 考虑因素 | 说明 |
|----------|------|
| 网络延迟 | ECS 和 DashScope API 同在阿里云，内网互通，评估速度快 |
| 维护成本 | Docker 一键部署/更新/回滚，不用操心环境差异 |
| 成本 | 2核4G ECS 约 ¥100-200/月，够支撑日常使用 |
| 稳定性 | `restart: always` 保证进程挂了自动重启 |
| 数据安全 | 报告数据挂载到宿主机，定期备份即可 |

---

## 第一步：准备服务器

```bash
# 1. 买一台阿里云 ECS（推荐 CentOS 7.9 或 Ubuntu 22.04）
#    配置：2核4G，系统盘40G，带宽按量
#    地域选和 DashScope 同区（华东1/华东2）

# 2. SSH 登录后安装 Docker
curl -fsSL https://get.docker.com | bash
systemctl enable docker
systemctl start docker

# 3. 安装 Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

---

## 第二步：上传项目

```bash
# 在本地打包（排除不需要的文件）
cd d:/myself/Safe_evaluate
tar --exclude='node_modules' --exclude='.venv' --exclude='.git' --exclude='backend/data' -czf safe-evaluate.tar.gz .

# 上传到服务器
scp safe-evaluate.tar.gz root@你的ECS公网IP:/opt/

# 在服务器上解压
ssh root@你的ECS公网IP
cd /opt && mkdir -p safe-evaluate && cd safe-evaluate
tar -xzf ../safe-evaluate.tar.gz
```

---

## 第三步：配置环境变量

```bash
# 在服务器上创建 .env
cd /opt/safe-evaluate
cat > .env << 'EOF'
QWEN_API_KEY=sk-ws-H.你的API_KEY
QWEN_API_BASE=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen-vl-plus
APP_USERS={"110Csust@": "110Csust@"}
JWT_SECRET=$(openssl rand -hex 32)
JWT_EXPIRY_HOURS=24
CORS_ORIGINS=https://你的域名.com
EOF

# 重要：用随机密钥替换 JWT_SECRET
JWT_SECRET=$(openssl rand -hex 32)
sed -i "s/\$(openssl rand -hex 32)/$JWT_SECRET/" .env
```

---

## 第四步：构建前端

```bash
# 在本地构建前端（或者在服务器上装Node构建）
cd frontend
npm install
npm run build
# 产物在 frontend/dist/

# 如果域名已确定，打包前在 vite.config.js 里确认 base 配置
```

---

## 第五步：配置 Nginx 和 SSL

```bash
# 把 nginx.conf 里的 your-domain.com 改成实际域名
vim nginx.conf

# 用 acme.sh 申请免费SSL证书
curl https://get.acme.sh | sh
~/.acme.sh/acme.sh --issue -d 你的域名.com --nginx
~/.acme.sh/acme.sh --install-cert -d 你的域名.com \
    --key-file /opt/safe-evaluate/ssl/key.pem \
    --fullchain-file /opt/safe-evaluate/ssl/cert.pem
```

---

## 第六步：启动

```bash
cd /opt/safe-evaluate
docker-compose up -d

# 查看状态
docker-compose ps
docker-compose logs -f backend

# 测试
curl http://localhost:8000/api/health
```

---

## 日常运维

### 更新代码

```bash
# 本地改完代码后
cd d:/myself/Safe_evaluate
tar -czf update.tar.gz backend/ frontend/dist/ requirement/
scp update.tar.gz root@ECS:/opt/safe-evaluate/

# 服务器上
cd /opt/safe-evaluate
tar -xzf update.tar.gz
docker-compose down
docker-compose up -d --build
```

### 备份报告数据

```bash
# 每天凌晨2点自动备份（加到 crontab）
0 2 * * * tar -czf /backup/reports-$(date +\%Y\%m\%d).tar.gz /opt/safe-evaluate/backend/data/ && find /backup/ -mtime +30 -delete
```

### 查看日志

```bash
docker-compose logs -f backend --tail=100
```

### 扩容

如果使用量大了变慢：
- ECS 升级到 4核8G
- docker-compose.yml 里把 `--workers 4` 改成 `--workers 8`

---

## 成本预估

| 项目 | 月费用 |
|------|--------|
| ECS 2核4G | ¥100-200 |
| 系统盘 40G | ¥14 |
| 带宽（按量/5Mbps） | ¥100-200 |
| DashScope API | 按调用量，图片评估约 ¥0.01-0.05/次 |
| **合计** | **¥200-400/月** |
