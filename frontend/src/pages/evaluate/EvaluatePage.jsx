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
  const navigate = useNavigate();

  async function handleSubmit() {
    setError(null);

    if (files.length === 0) {
      setError({ message: '请先上传评估资料' });
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      formData.append('rules', JSON.stringify(selectedRules));

      const res = await submitEvaluation(formData);

      // Check if the backend reported a failure
      if (res.data.status === 'failed') {
        setError({
          message: res.data.error || '评估执行失败，AI 服务暂时不可用',
          reportId: res.data.report_id,
          retryable: true,
        });
        return;
      }

      navigate(`/report/${res.data.report_id}`);
    } catch (err) {
      const detail = err.response?.data?.detail || '';
      const status = err.response?.status || 0;

      if (status === 502 || status === 500) {
        // Server-side error — may include a saved report_id in detail
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
  }

  return (
    <div>
      {isSubmitting && <Loading text="正在分析评估中，预计 1-3 分钟（含自动重试）..." />}

      <div className={styles.header}>
        <h1 className={styles.title}>新建消防安全评估</h1>
        <p className={styles.subtitle}>
          上传消防现场照片或图纸（支持多张），AI 将依据消防法规自动生成安全风险评估报告
        </p>
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

          <div className={styles.footer}>
            <span className={styles.estimate}>
              {files.length > 0
                ? `已选择 ${files.length} 个文件，评估将调用 AI 模型进行分析，预计耗时 1-3 分钟（含自动重试）`
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
