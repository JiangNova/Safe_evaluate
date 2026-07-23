import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UploadZone from './UploadZone';
import RuleSelector from './RuleSelector';
import Button from '../../components/ui/Button';
import Loading from '../../components/ui/Loading';
import { submitEvaluation } from '../../services/api';
import styles from './EvaluatePage.module.css';

export default function EvaluatePage() {
  const [file, setFile] = useState(null);
  const [selectedRules, setSelectedRules] = useState([
    'gb50016',
    'gb50116',
    'gb50974',
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleSubmit() {
    setError('');

    if (!file) {
      setError('请先上传评估资料');
      return;
    }
    if (selectedRules.length === 0) {
      setError('请至少选择一项评估规则');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('rules', JSON.stringify(selectedRules));

      const res = await submitEvaluation(formData);
      navigate(`/report/${res.data.report_id}`);
    } catch (err) {
      setError(err.response?.data?.message || '评估提交失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      {isSubmitting && <Loading text="正在分析评估中，预计 30-60 秒..." />}

      <div className={styles.header}>
        <h1 className={styles.title}>新建消防安全评估</h1>
        <p className={styles.subtitle}>
          上传消防图纸或现场照片，选择评估标准，生成评估报告
        </p>
      </div>

      {error && (
        <div
          style={{
            background: 'var(--color-danger-bg)',
            border: '1px solid var(--color-danger-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            fontSize: '12px',
            color: 'var(--color-danger)',
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
      )}

      <div className={styles.grid}>
        <UploadZone file={file} onFileChange={setFile} />
        <RuleSelector selected={selectedRules} onChange={setSelectedRules} />
      </div>

      <div className={styles.footer}>
        <span className={styles.estimate}>
          评估将调用 AI 模型进行分析，预计耗时 30-60 秒
        </span>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          开始评估
        </Button>
      </div>
    </div>
  );
}
