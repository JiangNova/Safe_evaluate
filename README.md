# SafeEvaluate — 消防安全评估系统

基于千问（Qwen）大模型的消防安全智能评估平台，依据上传的消防法规要求对现场图片/图纸进行安全风险评估。

## 项目结构

```
Safe_evaluate/
├── requirement/                 # 消防安全法规参考文档（4份）
│   ├── 2026派出所防火工作调度部署会材料.docx
│   ├── 名词解读.docx
│   ├── 派出所防火工作消防监督指引手册7(2026版).docx
│   └── 消防界定标准 (3).doc
├── backend/                     # Python FastAPI 后端
│   ├── main.py                  # FastAPI 应用入口 + 路由
│   ├── config.py                # 配置文件（API Key、模型等）
│   ├── models.py                # Pydantic 数据模型
│   ├── database.py              # JSON文件报告存储
│   ├── auth.py                  # JWT认证
│   ├── evaluator.py             # 千问API 调用 + 图片评估
│   ├── document_parser.py       # 解析 requirement/ 下的法规文档
│   ├── prompts.py               # 评估提示词模板
│   └── data/reports/            # 报告存储目录
├── frontend/                    # React + Vite 前端
│   └── src/...
├── setup_backend.bat            # 后端一键安装脚本
├── start_backend.bat            # 后端启动脚本
└── README.md
```

## 快速开始

### 1. 安装后端依赖

```bash
# 方式一：一键安装（推荐）
setup_backend.bat

# 方式二：手动安装
pip install fastapi uvicorn[standard] python-multipart python-docx httpx pydantic PyJWT
# 如果 SSL 错误，用清华镜像：
pip install fastapi uvicorn[standard] python-multipart python-docx httpx pydantic PyJWT -i https://pypi.tuna.tsinghua.edu.cn/simple --trusted-host pypi.tuna.tsinghua.edu.cn
```

### 2. 启动后端（端口 8000）

```bash
# 方式一：使用启动脚本
start_backend.bat

# 方式二：手动启动
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

API 文档自动生成：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 3. 启动风险评估平台（端口 3000）

```bash
cd frontend
npm install
npm run dev
```

访问: http://127.0.0.1:3000/evaluate

### 4. 启动 AGULAB 官网（端口 5173）

```bash
cd website
npm install
npm run dev
```

开发地址：`http://127.0.0.1:5173/website-static/`

生产环境中，Nginx 会将官网放在 `/`，风险评估平台放在
`/evaluate`，后端接口保留为 `/api/*`。

完成两个前端构建后，可在不安装 Docker 的电脑上预览同域路由：

```bash
python scripts/serve-integration.py --port 8080
```

访问 `http://127.0.0.1:8080/`。该脚本仅监听本机，并将 `/api/*`
转发到本地 8000 端口。

### 5. 登录

账号、密码和 JWT 密钥必须在本地或服务器 `.env` 中配置。项目不再提供
可直接用于生产环境的默认登录凭据。

## 使用流程

1. **登录** → 进入系统
2. **新建评估** → 上传消防现场照片/图纸（支持 JPG/PNG/GIF/BMP/WebP/PDF）
3. **选择评估规则** → 勾选要依据的消防法规标准
4. **开始评估** → 系统将图片+法规发送给千问视觉大模型进行分析
5. **查看报告** → 评估完成，查看合规项/不合规项/整改建议
6. **历史记录** → 查看过往评估报告，导出打印

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录获取Token |
| POST | `/api/evaluate` | 提交图片+规则进行评估 |
| GET | `/api/reports/{id}` | 获取评估报告 |
| GET | `/api/reports?page=&page_size=` | 历史报告列表 |
| GET | `/api/health` | 健康检查（含文档加载状态） |

## 评估依据

系统会自动加载 `requirement/` 文件夹下的所有消防法规文档作为评估依据：

- **2026派出所防火工作调度部署会材料** — 上级发文、警示案例、工作要求
- **名词解读** — 消防法规关键术语定义
- **派出所防火工作消防监督指引手册(2026版)** — 检查职责、对象、流程、隐患处理
- **消防界定标准** — 长沙市+湖南省消防安全重点单位界定标准

## 技术栈

- **官网**: React 19 + TypeScript + Vite
- **风险评估平台**: React 18 + Vite + React Router 7 + CSS Modules
- **后端**: Python FastAPI + Pydantic + python-docx
- **AI**: 阿里云千问 Qwen3.7-vl-plus（视觉大模型）
- **存储**: JSON 文件存储
- **认证**: JWT Token
