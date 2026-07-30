import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UploadZone from '../../../frontend/src/pages/evaluate/UploadZone';
import Button from '../../../frontend/src/components/ui/Button';
import Loading from '../../../frontend/src/components/ui/Loading';
import RuleSelector from './RuleSelector';
import { submitEvaluation } from '../services/api';
import styles from '../../../frontend/src/pages/evaluate/EvaluatePage.module.css';

export default function EvaluatePage() {
  const [files, setFiles] = useState([]);
  const [selectedRules, setSelectedRules] = useState([]);
  const [mode, setMode] = useState('single');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [completedIds, setCompletedIds] = useState([]);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  function updateTask(index, updates) {
    setTasks((current) => {
      const next = [...current];
      if (next[index]) next[index] = { ...next[index], ...updates };
      return next;
    });
  }

  async function evaluateFile(index, file, maxRetries = 3) {
    let lastError = '评估失败';

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      updateTask(index, { status: 'running', retries: attempt });
      try {
        const formData = new FormData();
        formData.append('files', file);
        formData.append('rules', JSON.stringify(selectedRules));
        const response = await submitEvaluation(formData);

        if (response.data.status !== 'failed') {
          updateTask(index, {
            status: 'success',
            reportId: response.data.report_id,
            error: null,
          });
          return response.data.report_id;
        }

        lastError = response.data.error || 'AI 服务暂时不可用';
      } catch (requestError) {
        lastError =
          requestError.response?.data?.detail ||
          requestError.message ||
          '网络连接失败';

        const status = requestError.response?.status;
        if (status && status < 500 && status !== 429) break;
      }

      updateTask(index, { status: 'failed', error: lastError });
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    updateTask(index, { status: 'failed', error: lastError });
    return null;
  }

  async function runSingleEvaluation() {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('rules', JSON.stringify(selectedRules));

    const response = await submitEvaluation(formData);
    if (response.data.status === 'failed') {
      throw new Error(response.data.error || 'AI 服务暂时不可用');
    }

    setCompletedIds([response.data.report_id]);
    setDone(true);
  }

  async function runSplitEvaluation() {
    const initialTasks = files.map((file) => ({
      file,
      filename: file.name,
      status: 'pending',
      retries: 0,
      error: null,
      reportId: null,
    }));
    setTasks(initialTasks);

    const results = await Promise.allSettled(
      initialTasks.map((task, index) => evaluateFile(index, task.file)),
    );
    setCompletedIds(
      results
        .filter((result) => result.status === 'fulfilled' && result.value)
        .map((result) => result.value),
    );
    setDone(true);
  }

  async function handleSubmit() {
    setError(null);
    setDone(false);

    if (files.length === 0) {
      setError('请先上传评估资料');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'single') {
        await runSingleEvaluation();
      } else {
        await runSplitEvaluation();
      }
    } catch (requestError) {
      const detail =
        requestError.response?.data?.detail ||
        requestError.message ||
        '评估提交失败，请稍后重试';
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  }

  async function retryFailed() {
    const failed = tasks
      .map((task, index) => ({ task, index }))
      .filter(({ task }) => task.status === 'failed');
    if (failed.length === 0) return;

    setDone(false);
    setSubmitting(true);
    const results = await Promise.allSettled(
      failed.map(({ task, index }) => evaluateFile(index, task.file)),
    );
    const successfulIds = tasks
      .filter((task) => task.status === 'success')
      .map((task) => task.reportId);
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        successfulIds.push(result.value);
      }
    });
    setCompletedIds([...new Set(successfulIds)]);
    setDone(true);
    setSubmitting(false);
  }

  return (
    <div>
      {submitting && mode === 'single' && (
        <Loading text="正在分析评估中，预计 1–3 分钟..." />
      )}

      <div className={styles.header}>
        <div>
          <p className={styles.subtitle}>AUTOMATED SAFETY EVALUATION</p>
          <h1 className={styles.title}>新建安全风险评估</h1>
        </div>
        <p className={styles.subtitle}>
          上传现场照片、图纸或 PDF，AI 将依据所选标准生成结构化评估报告
        </p>
      </div>

      <div className={styles.modeTabs}>
        <button
          type="button"
          className={`${styles.modeTab} ${mode === 'single' ? styles.modeTabActive : ''}`}
          onClick={() => setMode('single')}
        >
          🔗 单次评估
        </button>
        <button
          type="button"
          className={`${styles.modeTab} ${mode === 'multi' ? styles.modeTabActive : ''}`}
          onClick={() => setMode('multi')}
        >
          📄 分图评估
        </button>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <div className={styles.errorTitle}>⚠️ 评估未完成</div>
          <p className={styles.errorMessage}>{error}</p>
          <p className={styles.retryHint}>请检查文件或网络连接后重试。</p>
        </div>
      )}

      <div className={styles.columns}>
        <div className={styles.mainCol}>
          <UploadZone files={files} onFilesChange={setFiles} />

          {submitting && mode === 'multi' && (
            <div className={styles.progressPanel}>
              <div className={styles.progressHeader}>
                <span className={styles.progressTitle}>正在逐项评估...</span>
                <span className={styles.progressCount}>
                  {tasks.filter((task) => task.status === 'success').length}/{tasks.length} 完成
                </span>
              </div>
              <div className={styles.taskList}>
                {tasks.map((task) => (
                  <div key={task.filename} className={styles.taskRow}>
                    <span className={styles.taskStatus}>
                      {task.status === 'success' ? '✅' : task.status === 'failed' ? '❌' : '⏳'}
                    </span>
                    <span className={styles.taskFilename}>{task.filename}</span>
                    <span className={styles.taskLabel}>
                      {task.status === 'success'
                        ? '评估完成'
                        : task.status === 'failed'
                          ? `失败（已重试 ${task.retries} 次）`
                          : '评估中...'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {done && !submitting && (
            <div className={styles.resultPanel}>
              <span className={styles.resultIcon}>
                {completedIds.length > 0 ? '✅' : '⚠️'}
              </span>
              <div className={styles.resultInfo}>
                <div className={styles.resultTitle}>
                  {completedIds.length > 0 ? '评估完成' : '本次评估未生成报告'}
                </div>
                <div className={styles.resultDesc}>
                  {mode === 'multi'
                    ? `已生成 ${completedIds.length} 份评估报告`
                    : 'AI 已生成安全风险评估报告'}
                </div>
              </div>
              {completedIds.length > 0 && (
                <Button
                  onClick={() =>
                    navigate(
                      mode === 'single'
                        ? `/report/${completedIds[0]}`
                        : `/summary?ids=${completedIds.join(',')}`,
                    )
                  }
                >
                  查看报告
                </Button>
              )}
              {tasks.some((task) => task.status === 'failed') && (
                <Button variant="secondary" onClick={retryFailed}>
                  重试失败项
                </Button>
              )}
            </div>
          )}

          <div className={styles.footer}>
            <span className={styles.estimate}>
              {files.length > 0
                ? `已选择 ${files.length} 个文件`
                : '支持 JPG、PNG、GIF、BMP、WebP 和 PDF'}
            </span>
            <Button onClick={handleSubmit} disabled={submitting}>
              开始评估
            </Button>
          </div>
        </div>

        <div className={styles.sideCol}>
          <RuleSelector selected={selectedRules} onChange={setSelectedRules} />
        </div>
      </div>
    </div>
  );
}

