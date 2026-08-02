# 通用自动评估平台模板化输出设计

## 1. 背景与目标

当前 `/evaluate/` 公共版是匿名、一次性的消防安全评估流程：用户上传图片或 PDF，选择平台预设规则，模型返回固定的消防报告 JSON，前端按固定页面展示。

本次改造将公共版升级为领域无关的通用自动评估平台。每个用户自行提供：

1. 评估目标与要求；
2. 待评估材料；
3. 评估依据文件；
4. 一个或多个输出模板。

平台依据用户提供的要求和依据分析材料，并将结果填入用户提供的 Word 或 PDF 模板。用户可以在线校核和修改生成内容，最终下载 DOCX、PDF 或包含多份文书的 ZIP。

## 2. 本期范围

### 2.1 包含

- 匿名、一次性通用评估任务；
- 必填的评估目标/要求文本；
- 待评估材料：图片、PDF、DOCX；
- 评估依据：PDF、DOCX、TXT；
- 输出模板：DOCX、PDF，一次可上传多个；
- 模板占位符解析；
- 无占位符模板的 AI 字段识别与人工确认；
- 文本型 PDF 和扫描型 PDF 模板解析；
- 在线字段校核、人工编辑、单字段重新生成和恢复 AI 初稿；
- DOCX 模板导出 DOCX 和 PDF；
- PDF 模板导出填充后的 PDF；
- 多文书 ZIP 下载；
- 匿名任务的限时访问与自动清理；
- 原公共消防评估能力的兼容迁移。

### 2.2 不包含

- 用户注册、登录和个人历史记录；
- 公共模板库、管理员审核和模板共享；
- Excel、CSV 或任意二进制输入；
- PDF 模板反向生成可编辑 DOCX；
- 对任意复杂模板承诺像素级无偏差；
- 长期归档、电子签章和正式公文编号管理。

## 3. 核心设计原则

采用“混合模板编译”方案：

- AI 负责理解材料、依据、评估目标和模板语义；
- AI 输出领域无关的结构化评估结果和模板字段值；
- 确定性的文档引擎负责填充 Word/PDF 和生成最终文件；
- 用户必须能够确认低置信度字段并校核最终内容；
- 评估、模板解析、字段映射和文档渲染相互隔离，可分别失败和重试。

不让大模型直接创建最终二进制文档。这样可以降低表格错位、分页漂移、字段遗漏和模型版本变化带来的不确定性。

## 4. 用户流程

公共版改为单页分步流程：

1. **描述评估任务**：填写必填的评估目标/要求。
2. **上传待评估材料**：上传图片、PDF 或 DOCX，可多选。
3. **上传评估依据**：上传 PDF、DOCX 或 TXT，至少一份。
4. **上传输出模板**：上传一个或多个 DOCX/PDF 模板。
5. **确认模板字段**：系统解析占位符、标题、表格和填写区域；没有占位符时由 AI 识别，用户确认字段名称、类型、重复规则和 PDF 坐标。
6. **开始评估**：系统先形成统一评估结果，再映射到各模板字段。
7. **校核文书**：按模板切换预览，修改字段、单字段重新生成或恢复 AI 初稿。
8. **定稿与下载**：分别下载，或一次下载 ZIP。

模板字段确认完成前不能开始评估。已带有明确标准占位符且解析无歧义的模板仍显示快速确认页，不直接跳过。

## 5. 文件与模板规则

### 5.1 占位符

DOCX 首选 `{{field_name}}` 形式的占位符。解析范围包括：

- 正文段落；
- 表格单元格；
- 页眉和页脚；
- 同一字段的多次引用；
- 可重复行或列表区域。

如果 Word 将一个占位符拆分到多个 run，解析器需要合并文本后识别，并在写回时尽量继承首个 run 的样式。

### 5.2 无占位符模板

系统提取文档文本、表格结构、页码和坐标，交由模板识别模型生成字段定义。每个字段至少包含：

- 稳定字段键；
- 用户可见名称；
- 字段类型；
- 是否必填；
- 是否允许多行；
- 是否为重复项；
- 来源位置；
- 识别置信度；
- Word 结构定位或 PDF 页码与矩形坐标。

用户可在确认页修改字段定义。低置信度字段必须显式确认。

### 5.3 PDF 模板

- 文本型 PDF：提取文本块和坐标；
- 扫描型 PDF：渲染页面后 OCR，生成候选填写区域；
- 原 PDF 页面作为最终输出底稿，内容按确认后的坐标覆盖；
- 用户可调整坐标、字体大小、对齐方式和多行区域；
- 检测到溢出时阻止静默定稿，要求缩小字体、扩大区域或修改内容。

### 5.4 Word 模板

- 保留原样式、页边距、页眉页脚和表格结构；
- 字段内容过长时允许自然扩展，但必须检测明显分页变化和表格溢出；
- DOCX 定稿后通过固定版本的 LibreOffice Headless 转换为 PDF。

## 6. 通用评估数据模型

评估模型不再依赖消防专用的 `findings/category/inspection_record` 固定结构。统一结果采用领域无关结构：

```json
{
  "title": "评估标题",
  "executive_summary": "总体结论",
  "overall_result": "pass|fail|conditional|unknown",
  "criteria_results": [
    {
      "criterion": "评估项",
      "result": "pass|fail|partial|unknown",
      "observation": "材料中观察到的事实",
      "basis_reference": "评估依据中的出处",
      "reasoning": "结论理由",
      "recommendation": "改进建议",
      "evidence_refs": ["材料文件与页码/图片编号"]
    }
  ],
  "limitations": ["无法确认或材料不足的事项"],
  "source_index": []
}
```

模板字段值在统一结果之后单独生成：

```json
{
  "template_id": "opaque-id",
  "fields": {
    "unit_name": {"value": "示例", "source_refs": [], "confidence": 0.92}
  }
}
```

统一结果用于网页摘要、证据追踪和重新映射；模板字段用于文书渲染。两者不能合并成一份不可追踪的自由文本。

## 7. 数据与存储

新增以下 SQLite 表：

### `public_jobs`

- `id`：不可猜测任务 ID；
- `access_token_hash`：匿名访问凭证哈希；
- `goal`：评估目标；
- `status`：任务总体状态；
- `result_json`：统一评估结果；
- `error_json`：阶段化错误；
- `created_at`、`expires_at`。

### `public_job_files`

- `job_id`；
- `kind`：material、basis、template、generated；
- `safe_name`、`original_name`、`mime_type`、`size`；
- `storage_path`；
- `parse_status`、`parse_metadata_json`。

### `public_job_templates`

- `job_id`；
- `source_file_id`；
- `source_format`；
- `fields_json`；
- `preview_metadata_json`；
- `confirmation_status`。

### `public_job_documents`

- `job_id`、`template_id`；
- `ai_initial_fields_json`；
- `current_fields_json`；
- `status`：mapping、draft、finalizing、finalized、failed；
- `docx_file_id`、`pdf_file_id`；
- `warnings_json`、`error_json`。

### `public_job_revisions`

- `document_id`；
- `field_key`；
- `before_json`、`after_json`；
- `source`：ai、user、regenerate、restore；
- `created_at`。

文件存放在按任务隔离的目录中。任务默认保留 24 小时，过期清理同时删除数据库记录和物理文件。清理任务必须是幂等的。

## 8. 匿名访问与安全

- 创建任务时返回任务 ID 和一次性高熵访问 token；
- token 仅在客户端会话中保存，服务端只保存哈希；
- 后续读取、编辑和下载都必须同时提供任务 ID 与 token；
- 不再仅依赖可猜测或泄露的报告 ID 保护公共结果；
- 校验扩展名、MIME 和文件签名；
- 限制单文件大小、总文件大小、页数、文件数和解压后大小；
- 拒绝 DOCM、加密 PDF、损坏文件和嵌入式可执行内容；
- 使用重新生成的安全文件名，原始名称只作为元数据展示；
- 解析和转换进程设置超时、内存与 CPU 限制；
- 上传材料和依据均视为不可信内容，不能覆盖系统指令；
- 评估目标是用户意图，依据文件只提供判定标准，待评估材料只提供事实证据；三者在提示词中明确隔离；
- 公共接口增加速率限制和并发限制。

## 9. 后端组件与接口

### 9.1 组件

- `public_job_service`：任务生命周期、token 与过期清理；
- `input_parser`：图片、PDF、DOCX、TXT 的统一解析与来源定位；
- `template_parser`：占位符、Word 结构、PDF 坐标和 OCR；
- `generic_evaluator`：根据目标、依据和材料生成统一结果；
- `template_mapper`：根据字段定义生成字段值与来源引用；
- `document_renderer`：DOCX/PDF 套版、溢出检查和格式转换；
- `artifact_service`：安全下载和 ZIP 打包。

### 9.2 API 流程

1. `POST /api/public/jobs`：创建匿名任务并上传目标、材料和依据；
2. `POST /api/public/jobs/{id}/templates`：上传模板；
3. `GET /api/public/jobs/{id}/templates/{template_id}/parse-result`：读取字段与预览；
4. `PUT /api/public/jobs/{id}/templates/{template_id}/fields`：确认字段；
5. `POST /api/public/jobs/{id}/evaluate`：启动评估与多模板映射；
6. `GET /api/public/jobs/{id}`：读取阶段状态与结果；
7. `PUT /api/public/jobs/{id}/documents/{document_id}/fields`：保存人工修改；
8. `POST /api/public/jobs/{id}/documents/{document_id}/fields/{field_key}/regenerate`：单字段重生成；
9. `POST /api/public/jobs/{id}/documents/{document_id}/finalize`：定稿渲染；
10. `GET /api/public/jobs/{id}/artifacts/{file_id}`：下载单文件；
11. `POST /api/public/jobs/{id}/artifacts/archive`：生成并下载 ZIP。

长耗时步骤使用任务状态轮询。第一版沿用当前单进程部署，但组件接口不得依赖同步 HTTP 请求一直保持连接，以便后续接入任务队列。

## 10. 前端设计

公共评估页采用六步向导：

1. 评估说明；
2. 待评估材料；
3. 评估依据；
4. 输出模板；
5. 字段确认；
6. 生成与校核。

关键交互：

- 每类文件独立上传区，避免材料、依据和模板混淆；
- 上传前明确显示支持格式、数量和大小限制；
- 多模板以标签页切换；
- 左侧文档预览，右侧字段编辑；
- 字段显示 AI 置信度和来源引用；
- 自动保存人工修改；
- 草稿和定稿状态明确区分；
- 任务 token 保存在 `sessionStorage`，关闭会话后不形成长期身份；
- 页面显示 24 小时到期时间并提醒及时下载。

## 11. 错误处理

- 文件上传、解析、模板识别、评估、映射、渲染和打包分别记录状态；
- 任一模板失败不影响其他模板和统一评估结果；
- 已成功阶段不因重试而重复执行；
- 扫描件 OCR 失败或识别置信度不足时要求人工确认；
- 引用不到依据的结论标记为 `unknown`，不得编造；
- 材料不足时在 `limitations` 中说明，不强行给出通过或不通过；
- PDF 越界、Word 表格溢出或明显分页变化必须形成可见警告；
- 转换服务不可用时仍可保存草稿，DOCX 可先下载，PDF 可稍后单独重试；
- ZIP 只包含成功定稿的文件，并附带失败清单。

## 12. 兼容策略

- `/api/public/evaluate` 和现有公共报告页先保留，避免一次性破坏已有流程；
- 新流程使用 `/api/public/jobs/*`；
- 公共前端切换到新流程后，原消防规则选择作为可选的“示例/快捷模式”，不再是通用流程的必选依赖；
- 天心内部版 `/evaluate_tianxin/` 和受鉴权接口不在本期修改范围；
- 原 `reports` 数据和统计逻辑保持不变，新匿名通用任务使用独立表。

## 13. 验收标准

- 用户必须能独立上传评估材料、评估依据和多个输出模板；
- 含占位符 DOCX 能正确识别正文、表格、页眉页脚字段；
- 无占位符 DOCX、文本 PDF 和扫描 PDF 能进入字段识别与确认流程；
- 评估结果的每项结论包含材料证据和依据出处，无法确认时明确标记；
- 多模板可独立生成、编辑、单字段重生成、恢复和定稿；
- DOCX 模板可下载 DOCX/PDF，PDF 模板可下载填充 PDF；
- 多份定稿文书可打包下载；
- 匿名 token 缺失或错误时不能访问任务、预览和文件；
- 过期任务及文件能被幂等清理；
- 复杂表格、长文本、分页、PDF 坐标和 OCR 低置信度场景有明确告警；
- 覆盖文件伪装、超限、损坏、加密、转换失败和部分模板失败；
- 天心内部版和旧公共 API 回归测试通过。

## 14. 实施顺序

1. 匿名任务、token、文件存储和过期清理；
2. 通用输入解析和来源定位；
3. DOCX/PDF 模板解析、字段确认 API；
4. 通用评估结果与模板字段映射；
5. DOCX/PDF 渲染和安全下载；
6. 公共前端六步向导与校核工作台；
7. ZIP、单字段重生成、溢出告警；
8. 安全、异常、回归和端到端测试。
