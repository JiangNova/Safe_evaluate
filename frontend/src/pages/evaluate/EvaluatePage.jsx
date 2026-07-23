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
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleSubmit() {
    setError('');

    if (files.length === 0) {
      setError('请先上传评估资料');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      formData.append('rules', JSON.stringify(selectedRules));

      const res = await submitEvaluation(formData);
      navigate(`/report/${res.data.report_id}`);
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.message || '评估提交失败，请重试');
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
        <div className={styles.errorBanner}>{error}</div>
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
