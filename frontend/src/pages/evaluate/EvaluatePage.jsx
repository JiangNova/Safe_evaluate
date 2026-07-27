import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UploadZone from './UploadZone';
import RuleSelector from './RuleSelector';
import Button from '../../components/ui/Button';
import Loading from '../../components/ui/Loading';
import { submitEvaluation } from '../../services/api';
import styles from './EvaluatePage.module.css';

export default function EvaluatePage() {
  const [files, setFiles] = useState([]);
  const [selectedRules, setSelectedRules] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [taskStates, setTaskStates] = useState([]);
  const [allDone, setAllDone] = useState(false);
  const [multiReportIds, setMultiReportIds] = useState([]);
  const navigate = useNavigate();
  const [evaluateMode, setEvaluateMode] = useState('single'); // 'single' | 'multi'

  // Process one image → returns report_id on success, null on failure
  async function processOneTask(taskIndex, file, maxRetries) {
    const updateTask = (updates) => {
      setTaskStates((prev) => {
        const next = [...prev];
        if (next[taskIndex]) {
          next[taskIndex] = { ...next[taskIndex], ...updates };
        }
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
          lastError = res.data.error || 'AI 服务暂时不可用';
          updateTask({ status: 'failed', error: lastError });
          await new Promise((r) => setTimeout(r, 1000)); // brief delay before retry
          continue;
        }

        updateTask({ status: 'success', reportId: res.data.report_id, error: null });
        return res.data.report_id;
      } catch (err) {
        const detail = err.response?.data?.detail || err.message || '网络错误';
        lastError = detail;
        updateTask({ status: 'failed', error: detail });
        // Don't retry client errors (4xx except 429)
        if (err.response && err.response.status < 500 && err.response.status !== 429) {
          break;
        }
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    updateTask({ status: 'failed', error: lastError });
    return null;
  }

  async function handleSubmit() {
    setError(null);
    setAllDone(false);

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
          setError({
            message: res.data.error || '评估执行失败，AI 服务暂时不可用',
            reportId: res.data.report_id,
            retryable: true,
          });
          return;
        }

        setMultiReportIds([res.data.report_id]);
        setAllDone(true);
      } catch (err) {
        const detail = err.response?.data?.detail || '';
        const status = err.response?.status || 0;

        if (status === 502 || status === 500) {
          const match = detail.match(/报告ID[：:]?\s*([a-f0-9]+)/i);
          setError({
            message: detail || '服务器评估服务异常，请稍后重试',
            reportId: match ? match[1] : null,
            retryable: true,
          });
        } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
          setError({
            message: '评估请求超时，AI 服务响应时间过长，请稍后重试',
            retryable: true,
          });
        } else if (!err.response) {
          setError({
            message: '网络连接失败，请检查网络后重试',
            retryable: true,
          });
        } else {
          setError({
            message: detail || err.response?.data?.message || '评估提交失败，请重试',
            retryable: false,
          });
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
        status: 'pending',
        reportId: null,
        error: null,
        retries: 0,
        file: f,
      }));
      setTaskStates(initialTasks);

      const results = await Promise.allSettled(
        initialTasks.map((task, idx) =>
          processOneTask(idx, task.file, MAX_RETRIES)
        )
      );

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
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        existingIds.push(r.value);
      }
    }
    setMultiReportIds(existingIds);
    setAllDone(true);
    setIsSubmitting(false);
  }

  return (
    <div>
      {isSubmitting && evaluateMode === 'single' && <Loading text="正在分析评估中，预计 1-3 分钟（含自动重试）..." />}

      <div className={styles.header}>
        <h1 className={styles.title}>新建消防安全评估</h1>
        <p className={styles.subtitle}>
          上传消防现场照片或图纸（支持多张），AI 将依据消防法规自动生成安全风险评估报告
        </p>
      </div>

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

      {error && (
        <div className={styles.errorBanner}>
          <div className={styles.errorTitle}>
            {error.retryable ? '⚠️ 评估执行失败' : '❌ 提交失败'}
          </div>
          <p className={styles.errorMessage}>
            {typeof error === 'string' ? error : error.message}
          </p>
          {error.reportId && (
            <div className={styles.errorInfo}>
              <span>评估记录已保存（ID: {error.reportId}），可查看详细错误信息</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(`/report/${error.reportId}`)}
              >
                查看错误详情
              </Button>
            </div>
          )}
          {error.retryable && (
            <p className={styles.retryHint}>
              建议检查网络连接和 API 配置后重试。若持续失败，可能是 AI 服务暂时不可用，请稍后再试。
            </p>
          )}
        </div>
      )}

      <div className={styles.columns}>
        <div className={styles.mainCol}>
          <UploadZone files={files} onFilesChange={setFiles} />

          {/* Multi-mode progress panel */}
          {isSubmitting && evaluateMode === 'multi' && (
            <div className={styles.progressPanel}>
              <div className={styles.progressHeader}>
                <span className={styles.progressTitle}>🔄 正在评估中...</span>
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

          {/* Result panel — shown after evaluation completes */}
          {allDone && !isSubmitting && (
            <div className={styles.resultPanel}>
              {evaluateMode === 'single' ? (
                <>
                  <span className={styles.resultIcon}>✅</span>
                  <div className={styles.resultInfo}>
                    <div className={styles.resultTitle}>评估完成</div>
                    <div className={styles.resultDesc}>AI 已生成消防安全评估报告</div>
                  </div>
                  <Button onClick={() => navigate(`/report/${multiReportIds[0]}`)}>
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
                    <div className={styles.resultDesc}>分图评估已完成</div>
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
                    <Button variant="secondary" onClick={retryFailed} style={{ marginLeft: 8 }}>
                      🔄 重试失败项
                    </Button>
                  )}
                </>
              )}
            </div>
          )}

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
        </div>

        <div className={styles.sideCol}>
          <RuleSelector selected={selectedRules} onChange={setSelectedRules} />
        </div>
      </div>
    </div>
  );
}
