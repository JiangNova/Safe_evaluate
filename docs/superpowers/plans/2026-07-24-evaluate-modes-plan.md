# 评估双模式 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在评估页面新增"单次评估"和"分图评估"两种模式，分图模式下每张图片独立生成报告，并新增汇总页面展示所有报告卡片。

**Architecture:** 前端并发方案 — EvaluatePage 在分图模式下对每张图片独立发起 POST /api/evaluate，前端管理并发和进度；新增 EvaluateSummary 页展示结果卡片列表。后端零改动。

**Tech Stack:** React 18 + Vite + react-router-dom v6 + react-dropzone + CSS Modules

**涉及文件:**
- 修改: `frontend/src/pages/evaluate/EvaluatePage.jsx`
- 修改: `frontend/src/pages/evaluate/EvaluatePage.module.css`
- 新建: `frontend/src/pages/evaluate/EvaluateSummary.jsx`
- 新建: `frontend/src/pages/evaluate/EvaluateSummary.module.css`
- 修改: `frontend/src/App.jsx`

---

### Task 1: EvaluatePage — 模式切换 UI + CSS

**说明:** 在 UploadZone 上方添加两个 Tab 切换按钮，选中态高亮。分图模式下底部提示文案变更。

**修改:** `frontend/src/pages/evaluate/EvaluatePage.jsx:1-138`
**修改:** `frontend/src/pages/evaluate/EvaluatePage.module.css:1-99`

- [ ] **Step 1: 添加 evaluateMode state 和切换 UI**

在 EvaluatePage.jsx 中，在 `const navigate = useNavigate();` 后添加：

```jsx
const [evaluateMode, setEvaluateMode] = useState('single'); // 'single' | 'multi'
```

在 header 之后、columns 之前，添加模式切换条：

```jsx
<div className={styles.modeTabs}>
  <button
    className={`${styles.modeTab} ${evaluateMode === 'single' ? styles.modeTabActive : ''}`}
    onClick={() => setEvaluateMode('single')}
  >
    🔗 单次评估
  </button>
  <button
    className={`${styles.modeTab} ${evaluateMode === 'multi' ? styles.modeTabActive : ''}`}
    onClick={() => setEvaluateMode('multi')}
  >
    📄 分图评估
  </button>
</div>
```

- [ ] **Step 2: 分图模式下底部提示文案变更**

将 footer 中的文案改为根据模式切换：

```jsx
<div className={styles.footer}>
  <span className={styles.estimate}>
    {files.length > 0
      ? evaluateMode === 'multi'
        ? `已选择 ${files.length} 个文件，分图模式将为每张图片生成独立报告，预计耗时 ${files.length * 2}-${files.length * 4} 分钟`
        : `已选择 ${files.length} 个文件，评估将调用 AI 模型进行分析，预计耗时 1-3 分钟（含自动重试）`
      : '评估将调用 AI 模型依据消防法规进行分析'}
  </span>
  <Button onClick={handleSubmit} disabled={isSubmitting}>
    开始评估
  </Button>
</div>
```

- [ ] **Step 3: 添加 CSS 样式**

在 `EvaluatePage.module.css` 中，在 `.header` 样式块后添加：

```css
/* Mode tabs */
.modeTabs {
  display: flex;
  gap: 0;
  margin-bottom: var(--spacing-lg);
  border: 1px solid var(--border-input);
  border-radius: var(--radius-sm);
  overflow: hidden;
  width: fit-content;
}

.modeTab {
  padding: 8px 20px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.modeTab:first-child {
  border-right: 1px solid var(--border-input);
}

.modeTab:hover {
  background: #f1f5f9;
}

.modeTabActive {
  background: var(--color-primary);
  color: #fff;
}

.modeTabActive:hover {
  background: var(--color-primary);
}
```

- [ ] **Step 4: 验证**

打开 http://localhost:3000/evaluate，确认两个 Tab 显示正常，切换有高亮，底部文案切换正确。

---

### Task 2: EvaluatePage — 分图模式并发提交 + 进度展示

**说明:** 实现 `handleSubmit` 中分图模式的逻辑：并发 N 个请求、进度跟踪、自动重试。

**修改:** `frontend/src/pages/evaluate/EvaluatePage.jsx`

- [ ] **Step 1: 添加分图模式需要的 state**

在 `const [error, setError] = useState(null);` 后添加：

```jsx
const [taskStates, setTaskStates] = useState([]); // [{filename, status, reportId?, error?, retries}]
const [allDone, setAllDone] = useState(false);
const [multiReportIds, setMultiReportIds] = useState([]);
```

- [ ] **Step 2: 重写 handleSubmit 支持两种模式**

替换现有的 `handleSubmit` 函数：

```jsx
async function handleSubmit() {
  setError(null);
  if (files.length === 0) {
    setError({ message: '请先上传评估资料' });
    return;
  }

  if (evaluateMode === 'single') {
    // === 单次评估（现有逻辑） ===
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      formData.append('rules', JSON.stringify(selectedRules));
      const res = await submitEvaluation(formData);
      if (res.data.status === 'failed') {
        setError({ message: res.data.error || '评估执行失败，AI 服务暂时不可用', reportId: res.data.report_id, retryable: true });
      } else {
        setAllDone(true);
        setMultiReportIds([res.data.report_id]);
      }
    } catch (err) {
      /* 现有的错误处理保持不变 */
      const detail = err.response?.data?.detail || '';
      const status = err.response?.status || 0;
      if (status === 502 || status === 500) {
        const match = detail.match(/报告ID[：:]?\s*([a-f0-9]+)/i);
        setError({ message: detail || '服务器评估服务异常，请稍后重试', reportId: match ? match[1] : null, retryable: true });
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setError({ message: '评估请求超时，AI 服务响应时间过长，请稍后重试', retryable: true });
      } else if (!err.response) {
        setError({ message: '网络连接失败，请检查网络后重试', retryable: true });
      } else {
        setError({ message: detail || err.response?.data?.message || '评估提交失败，请重试', retryable: false });
      }
    } finally {
      setIsSubmitting(false);
    }
  } else {
    // === 分图评估 ===
    setIsSubmitting(true);
    const MAX_RETRIES = 3;
    const initialTasks = files.map((f) => ({
      filename: f.name,
      status: 'pending', // pending | running | success | failed
      reportId: null,
      error: null,
      retries: 0,
      file: f,
    }));
    setTaskStates(initialTasks);
    setAllDone(false);

    // 并发处理所有 task
    const results = await Promise.allSettled(
      initialTasks.map((task, idx) =>
        processOneTask(idx, task.file, MAX_RETRIES)
      )
    );

    // 收集成功的 report_id
    const ids = [];
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        ids.push(r.value);
      }
    }
    setMultiReportIds(ids);
    setAllDone(true);
    setIsSubmitting(false);
  }
}
```

- [ ] **Step 3: 添加 processOneTask 辅助函数**

在 `handleSubmit` 之前添加：

```jsx
async function processOneTask(taskIndex, file, maxRetries) {
  const updateTask = (updates) => {
    setTaskStates((prev) => {
      const next = [...prev];
      next[taskIndex] = { ...next[taskIndex], ...updates };
      return next;
    });
  };

  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    updateTask({ status: 'running', retries: attempt });

    try {
      const formData = new FormData();
      formData.append('files', file);
      formData.append('rules', JSON.stringify(selectedRules));

      const res = await submitEvaluation(formData);

      if (res.data.status === 'failed') {
        lastError = res.data.error || '评估执行失败';
        updateTask({ status: 'failed', error: lastError });
        continue; // retry
      }

      updateTask({ status: 'success', reportId: res.data.report_id, error: null });
      return res.data.report_id;
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || '网络错误';
      lastError = detail;
      updateTask({ status: 'failed', error: detail });
      // 非网络错误不重试
      if (err.response && err.response.status < 500 && err.response.status !== 429) {
        break;
      }
    }
  }

  updateTask({ status: 'failed', error: lastError });
  return null;
}
```

- [ ] **Step 4: 添加进度展示 UI**

在 UploadZone 之后、footer 之前，`isSubmitting && evaluateMode === 'multi'` 时显示：

```jsx
{isSubmitting && evaluateMode === 'multi' && (
  <div className={styles.progressPanel}>
    <div className={styles.progressHeader}>
      <span className={styles.progressTitle}>
        🔄 正在评估中...
      </span>
      <span className={styles.progressCount}>
        {taskStates.filter((t) => t.status === 'success').length}/{taskStates.length} 完成
      </span>
    </div>
    <div className={styles.progressBar}>
      <div
        className={styles.progressFill}
        style={{
          width: `${
            taskStates.length > 0
              ? Math.round(
                  (taskStates.filter((t) => t.status === 'success' || t.status === 'failed').length /
                    taskStates.length) *
                    100
                )
              : 0
          }%`,
        }}
      />
    </div>
    <div className={styles.taskList}>
      {taskStates.map((t, i) => (
        <div key={i} className={styles.taskRow}>
          <span className={styles.taskStatus}>
            {t.status === 'success' ? '✅' : t.status === 'failed' ? '❌' : t.status === 'running' ? '🔄' : '⏳'}
          </span>
          <span className={styles.taskFilename}>{t.filename}</span>
          <span className={styles.taskLabel}>
            {t.status === 'success'
              ? '评估完成'
              : t.status === 'failed'
              ? `失败 (已重试 ${t.retries} 次)`
              : t.status === 'running'
              ? '评估中...'
              : '等待中...'}
          </span>
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 5: 添加进度面板 CSS**

在 `EvaluatePage.module.css` 末尾添加：

```css
/* Progress panel */
.progressPanel {
  margin-top: var(--spacing-lg);
  padding: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-card);
  border-radius: var(--radius-md);
}

.progressHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.progressTitle {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.progressCount {
  font-size: 13px;
  color: var(--text-secondary);
}

.progressBar {
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 14px;
}

.progressFill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 3px;
  transition: width 0.4s ease;
}

.taskList {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.taskRow {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 4px 0;
}

.taskStatus {
  width: 20px;
  text-align: center;
}

.taskFilename {
  flex: 1;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.taskLabel {
  color: var(--text-muted);
  flex-shrink: 0;
}
```

- [ ] **Step 6: 验证**

上传 2-3 张图片，切换到分图模式，点击评估。观察进度列表每张图逐个更新，进度条增长。确认单次评估模式不受影响。

---

### Task 3: EvaluatePage — 完成结果展示 + 查看报告按钮

**说明:** 评估全部完成后（allDone），显示结果摘要和跳转按钮。

**修改:** `frontend/src/pages/evaluate/EvaluatePage.jsx`

- [ ] **Step 1: 添加完成结果 UI**

在 footer 上方（所有提交中状态之后），`allDone` 时显示：

```jsx
{allDone && !isSubmitting && (
  <div className={styles.resultPanel}>
    {evaluateMode === 'single' ? (
      <>
        <span className={styles.resultIcon}>✅</span>
        <div className={styles.resultInfo}>
          <div className={styles.resultTitle}>评估完成</div>
          <div className={styles.resultDesc}>AI 已生成消防安全评估报告</div>
        </div>
        <Button
          onClick={() => navigate(`/report/${multiReportIds[0]}`)}
        >
          查看报告
        </Button>
      </>
    ) : (
      <>
        <span className={styles.resultIcon}>
          {taskStates.every((t) => t.status === 'success') ? '✅' : '⚠️'}
        </span>
        <div className={styles.resultInfo}>
          <div className={styles.resultTitle}>
            {taskStates.filter((t) => t.status === 'success').length} 份成功
            {taskStates.some((t) => t.status === 'failed') &&
              `，${taskStates.filter((t) => t.status === 'failed').length} 份失败`}
          </div>
          <div className={styles.resultDesc}>
            分图评估已完成
          </div>
        </div>
        {multiReportIds.length > 0 && (
          <Button
            onClick={() =>
              navigate(`/evaluate/summary?ids=${multiReportIds.join(',')}`)
            }
          >
            查看全部报告
          </Button>
        )}
        {taskStates.some((t) => t.status === 'failed') && (
          <Button
            variant="secondary"
            onClick={() => {
              /* re-run failed tasks */
              retryFailed();
            }}
            style={{ marginLeft: 8 }}
          >
            重试失败项
          </Button>
        )}
      </>
    )}
  </div>
)}
```

- [ ] **Step 2: 添加 retryFailed 函数**

```jsx
async function retryFailed() {
  const failedIndices = taskStates
    .map((t, i) => (t.status === 'failed' ? i : -1))
    .filter((i) => i >= 0);

  if (failedIndices.length === 0) return;

  setAllDone(false);
  setIsSubmitting(true);

  const MAX_RETRIES = 3;
  const results = await Promise.allSettled(
    failedIndices.map((idx) =>
      processOneTask(idx, taskStates[idx].file, MAX_RETRIES)
    )
  );

  const existingIds = taskStates
    .filter((t) => t.status === 'success')
    .map((t) => t.reportId);
  const newIds = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      newIds.push(r.value);
    }
  }
  setMultiReportIds([...existingIds, ...newIds]);
  setAllDone(true);
  setIsSubmitting(false);
}
```

- [ ] **Step 3: 添加结果面板 CSS**

```css
/* Result panel */
.resultPanel {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: var(--spacing-lg);
  padding: 16px 20px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: var(--radius-md);
}

.resultIcon {
  font-size: 28px;
}

.resultInfo {
  flex: 1;
}

.resultTitle {
  font-size: 15px;
  font-weight: 600;
  color: #166534;
}

.resultDesc {
  font-size: 12px;
  color: #4ade80;
}
```

- [ ] **Step 4: 验证**

单次评估完成后出现 ✅ + 「查看报告」按钮。分图评估完成后出现结果摘要 + 「查看全部报告」按钮。有失败项时出现「重试失败项」按钮。

---

### Task 4: EvaluateSummary — 新建汇总页面

**说明:** 新页面接收 URL 参数 `ids`，并发获取各份报告，以卡片列表展示。

**新建:** `frontend/src/pages/evaluate/EvaluateSummary.jsx`
**新建:** `frontend/src/pages/evaluate/EvaluateSummary.module.css`

- [ ] **Step 1: 创建 EvaluateSummary.jsx**

```jsx
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { getReport } from '../../services/api';
import Button from '../../components/ui/Button';
import Loading from '../../components/ui/Loading';
import styles from './EvaluateSummary.module.css';

const RISK_LABELS = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
  failed: '评估失败',
};

const RISK_COLORS = {
  low: '#059669',
  medium: '#d97706',
  high: '#dc2626',
  failed: '#6b7280',
};

export default function EvaluateSummary() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ids = searchParams.get('ids')?.split(',').filter(Boolean) || [];

  const [reports, setReports] = useState([]); // [{id, data?, loading, error}]
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ids.length === 0) {
      navigate('/evaluate', { replace: true });
      return;
    }

    const initial = ids.map((id) => ({ id, data: null, loading: true, error: null }));
    setReports(initial);

    Promise.allSettled(
      ids.map((id) =>
        getReport(id)
          .then((res) => ({ id, data: res.data, loading: false, error: null }))
          .catch((err) => ({
            id,
            data: null,
            loading: false,
            error: err.response?.data?.detail || err.message || '加载失败',
          }))
      )
    ).then((results) => {
      setReports(results.map((r) => (r.status === 'fulfilled' ? r.value : { id: '', data: null, loading: false, error: '加载失败' })));
      setLoading(false);
    });
  }, [searchParams, navigate]);

  const successCount = reports.filter((r) => r.data && r.data.status !== 'failed').length;
  const failCount = reports.filter((r) => r.error || r.data?.status === 'failed').length;

  if (loading && reports.length === 0) return <Loading text="加载报告中..." />;

  return (
    <div>
      <button className={styles.backBtn} onClick={() => navigate('/evaluate')}>
        ← 返回评估
      </button>

      <div className={styles.header}>
        <h1 className={styles.title}>分图评估结果</h1>
        <p className={styles.subtitle}>
          {new Date().toLocaleDateString('zh-CN')} · {ids.length} 张图片
          {!loading && ` · ${successCount} 份完成，${failCount} 份失败`}
        </p>
      </div>

      <div className={styles.cardList}>
        {reports.map((r, i) => {
          const isFailed = !!r.error || r.data?.status === 'failed';
          const risk = r.data?.risk_level || (isFailed ? 'failed' : 'low');
          const stats = r.data?.stats || {};

          return (
            <div
              key={r.id}
              className={`${styles.card} ${isFailed ? styles.cardFailed : ''}`}
            >
              <div className={styles.cardHeader}>
                <span className={styles.cardStatus}>{isFailed ? '❌' : '✅'}</span>
                <span className={styles.cardFilename}>
                  {r.data?.filename || `报告 #${i + 1}`}
                </span>
                <span
                  className={styles.cardRisk}
                  style={{ color: RISK_COLORS[risk] || RISK_COLORS.failed }}
                >
                  {RISK_LABELS[risk] || RISK_LABELS.failed}
                </span>
              </div>

              {isFailed ? (
                <div className={styles.cardError}>
                  {r.error || r.data?.error_message || '评估执行失败，AI 服务暂时不可用'}
                </div>
              ) : (
                <>
                  <div className={styles.cardTitle}>
                    {r.data?.title || '消防安全评估报告'}
                  </div>
                  <div className={styles.cardStats}>
                    <span className={styles.stat}>✅ {stats.compliant || 0}</span>
                    <span className={styles.stat}>⚠️ {stats.nonCompliant || 0}</span>
                    <span className={styles.stat}>💡 {stats.suggestions || 0}</span>
                  </div>
                </>
              )}

              <div className={styles.cardActions}>
                {isFailed ? (
                  <button
                    className={styles.retryBtn}
                    disabled
                  >
                    🔄 重新评估（请返回评估页）
                  </button>
                ) : (
                  <Link to={`/report/${r.id}`} className={styles.viewBtn}>
                    查看报告 →
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 EvaluateSummary.module.css**

```css
.backBtn {
  background: none;
  border: none;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0;
  margin-bottom: var(--spacing-md);
}

.backBtn:hover {
  color: var(--color-primary);
}

.header {
  margin-bottom: 20px;
}

.title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.subtitle {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}

.cardList {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.card {
  background: var(--bg-card);
  border: 1px solid var(--border-card);
  border-radius: var(--radius-md);
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: box-shadow 0.2s;
}

.card:hover {
  box-shadow: var(--shadow-sm);
}

.cardFailed {
  border-left: 3px solid #dc2626;
  background: #fef2f2;
}

.cardHeader {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cardStatus {
  font-size: 18px;
}

.cardFilename {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cardRisk {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.cardTitle {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.cardStats {
  display: flex;
  gap: 16px;
  font-size: 12px;
}

.stat {
  color: var(--text-secondary);
}

.cardError {
  font-size: 12px;
  color: #dc2626;
  padding: 8px 10px;
  background: #fee2e2;
  border-radius: var(--radius-sm);
}

.cardActions {
  display: flex;
  justify-content: flex-end;
}

.viewBtn {
  font-size: 13px;
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 500;
}

.viewBtn:hover {
  text-decoration: underline;
}

.retryBtn {
  font-size: 12px;
  background: none;
  border: 1px solid var(--border-input);
  border-radius: var(--radius-sm);
  padding: 5px 12px;
  cursor: pointer;
  color: var(--text-secondary);
}
```

- [ ] **Step 3: 验证**

在分图评估完成后点击「查看全部报告」，确认跳转到汇总页，各张图片的卡片正常展示。

---

### Task 5: App.jsx — 添加汇总页路由

**修改:** `frontend/src/App.jsx`

- [ ] **Step 1: 添加 import**

```jsx
import EvaluateSummary from './pages/evaluate/EvaluateSummary';
```

- [ ] **Step 2: 添加路由**

在 `/evaluate` 路由之后添加：

```jsx
<Route path="/evaluate/summary" element={<ProtectedRoute><AppLayout><EvaluateSummary /></AppLayout></ProtectedRoute>} />
```

- [ ] **Step 3: 验证**

直接访问 `/evaluate/summary?ids=xxx,yyy` 确认路由生效。

---

### Task 6: 端到端验证

- [ ] **Step 1: 单次评估模式回归**

上传 2 张图片 → 单次评估 → 提交 → 等待完成 → 点击「查看报告」→ 进入报告页。确认和之前行为一致。

- [ ] **Step 2: 分图评估模式完整流程**

上传 3 张图片 → 切换到分图评估 → 提交 → 观察进度条和状态列表 → 等待全部完成 → 点击「查看全部报告」→ 汇总页展示 3 张卡片 → 点击某张卡片 → 跳转对应报告详情。

- [ ] **Step 3: 分图评估异常场景**

手动断开网络 → 分图评估 → 观察失败状态 → 恢复网络 → 点击「重试失败项」→ 确认重试成功。

---
