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
├── website/                     # React + Vite AGULAB 官网
├── frontend-public/             # 备案公开版自动安全评估平台
├── frontend/                    # 已有的天心区定制评判平台
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

### 2. 启动完整本地环境（推荐）

在项目根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-local.ps1
```

脚本会构建并测试三个前端、复用或启动后端、选择可用的本地预览端口，
然后自动打开官网。终端会打印最终入口：

- `/`：AGULAB 官网
- `/evaluate/`：公开自动安全评估平台
- `/evaluate_tianxin/`：天心区消防安全评估系统
- `/api/health`：后端健康检查

默认从 8080 端口开始选择。端口被占用时，脚本不会结束占用进程，而会自动
选择后续可用端口。再次启动且构建产物已是最新时，可使用 `-SkipBuild`；
不希望自动打开浏览器时，可使用 `-NoBrowser`。按 `Ctrl+C` 停止本次启动的
本地服务。

生产环境与本地完整预览使用相同的路径结构：

| 路径 | 服务 |
|------|------|
| `/` | AGULAB 官网 |
| `/evaluate/` | 公开自动安全评估平台 |
| `/evaluate_tianxin/` | 天心区定制评判平台 |
| `/api/*` | SafeEvaluate 后端接口 |

### 3. 高级：单应用开发

仅在独立开发某个应用时分别运行服务：

```powershell
# 后端：端口 8000
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload

# 天心区定制平台：进入 frontend 后运行
npm run dev

# 公开评估平台：进入 frontend-public 后运行
npm run dev

# AGULAB 官网：进入 website 后运行
npm run dev
```

单独的 Vite 开发或 Preview 服务只适用于组件开发，不实现生产环境的同域
路径分流，不能用于验证官网到 `/evaluate/` 或 `/evaluate_tianxin/` 的完整
跳转。跨应用联调始终使用 `scripts/start-local.ps1`。

API 文档：

- Swagger UI：`http://127.0.0.1:8000/docs`
- ReDoc：`http://127.0.0.1:8000/redoc`

`frontend-public` 提供无需登录的一次性评估流程，可上传材料、选择公开规则、
调用 AI 并查看本次报告；它不提供历史报告列表、统计或规则管理。需要登录的
内部定制平台仍位于 `frontend`。

### 4. 登录

账号、密码和 JWT 密钥必须在本地或服务器 `.env` 中配置。项目不再提供
可直接用于生产环境的默认登录凭据。

## 公开版使用流程

1. **新建评估** → 上传现场照片、图纸或 PDF
2. **选择评估规则** → 可选公开的通用安全标准
3. **开始评估** → 系统调用视觉大模型进行分析
4. **查看本次报告** → 查看符合项、风险项和整改建议

公开版不会提供历史报告列表。以下登录和管理功能仅用于
`/evaluate_tianxin/` 内部定制平台。

## 内部版使用流程

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
- **公开自动安全评估平台**: React 18 + React Router 7 + Vite + CSS Modules
- **天心区定制评判平台**: React 18 + Vite + React Router 7 + CSS Modules
- **后端**: Python FastAPI + Pydantic + python-docx
- **AI**: 阿里云千问 Qwen3.7-vl-plus（视觉大模型）
- **存储**: JSON 文件存储
- **认证**: JWT Token

## 通用自动评估与自定义输出模板

公开平台 `/evaluate/` 面向匿名用户提供通用评估流程：填写评估目标，分别上传待评估材料、评估依据和输出模板，确认模板字段后启动 AI 评估。输出模板支持 DOCX 与 PDF；DOCX 可使用 `{{field_name}}` 占位符，也可由系统识别标签位置，PDF 字段则在确认页校核页码与填写区域。

评估完成后可逐字段编辑、重新生成或恢复 AI 初稿，确认定稿后下载 DOCX、PDF 或全部文书 ZIP。匿名任务使用随机访问令牌隔离，数据库记录和文件默认保留 24 小时并由服务自动清理；部署时可通过 `PUBLIC_JOB_*`、`LIBREOFFICE_COMMAND` 和 `TESSERACT_COMMAND` 环境变量调整限制与运行时命令。
