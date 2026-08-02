import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FileSection from '../components/FileSection';
import StepIndicator from '../components/StepIndicator';
import { createPublicJob, uploadJobFiles, uploadJobTemplates } from '../services/api';
import { saveJobSession } from '../services/jobSession';
import styles from '../App.module.css';

const STEPS = ['评估说明', '待评估材料', '评估依据', '输出模板', '字段确认', '生成与校核'];

export default function JobWizardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState('');
  const [materials, setMaterials] = useState([]);
  const [bases, setBases] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const currentValid = useMemo(() => {
    if (step === 1) return goal.trim().length > 0;
    if (step === 2) return materials.length > 0;
    if (step === 3) return bases.length > 0;
    if (step === 4) return templates.length > 0;
    return false;
  }, [step, goal, materials, bases, templates]);

  function nextStep() {
    setError('');
    if (!currentValid) {
      setError('请完成当前步骤的必填内容');
      return;
    }
    if (step < 4) setStep((value) => value + 1);
    else submitJob();
  }

  async function submitJob() {
    setSubmitting(true);
    setError('');
    try {
      const created = await createPublicJob(goal.trim());
      const { job_id: jobId, access_token: token, expires_at: expiresAt } = created.data;
      saveJobSession(jobId, token, expiresAt);
      await uploadJobFiles(jobId, 'material', materials);
      await uploadJobFiles(jobId, 'basis', bases);
      await uploadJobTemplates(jobId, templates);
      navigate(`/jobs/${jobId}/templates`);
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail?.message ||
          requestError.response?.data?.detail ||
          requestError.message ||
          '任务创建失败，请稍后重试',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.flowPage}>
      <header className={styles.flowHeader}>
        <p>GENERIC EVALUATION</p>
        <h1>按你的依据评估，按你的模板输出</h1>
        <span>匿名任务将在创建 24 小时后自动清理，请及时下载结果。</span>
      </header>
      <a className={styles.workspaceHint} href="/workspace">有固定的评估标准或输出模板？进入长期工作区复用 →</a>

      <StepIndicator steps={STEPS} current={step} />

      <div className={styles.wizardCard}>
        {step === 1 && (
          <section className={styles.goalSection}>
            <div className={styles.sectionTitle}>
              <div>
                <h2>评估目标</h2>
                <p>说明需要判断什么、希望依据什么标准得出结论。</p>
              </div>
              <span>必填</span>
            </div>
            <textarea
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              maxLength={4000}
              placeholder="例如：依据上传的供应商准入标准，评估申请材料是否满足全部条件，并逐项说明证据、结论和改进建议。"
            />
            <small>{goal.length}/4000</small>
          </section>
        )}

        {step === 2 && (
          <FileSection
            kind="material"
            title="待评估材料"
            description="上传需要被评估的图片、PDF 或 Word 文档。"
            accept=".png,.jpg,.jpeg,.webp,.pdf,.docx"
            files={materials}
            onChange={setMaterials}
          />
        )}

        {step === 3 && (
          <FileSection
            kind="basis"
            title="评估依据"
            description="上传规则、标准、政策或检查要求，支持 PDF、Word 和 TXT。"
            accept=".pdf,.docx,.txt"
            files={bases}
            onChange={setBases}
          />
        )}

        {step === 4 && (
          <FileSection
            kind="template"
            title="输出模板"
            description="上传一个或多个 Word/PDF 模板，系统将识别待填写字段。"
            accept=".docx,.pdf"
            files={templates}
            onChange={setTemplates}
          />
        )}

        {error && <div className={styles.flowError}>{String(error)}</div>}

        <footer className={styles.wizardActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={step === 1 || submitting}
            onClick={() => setStep((value) => value - 1)}
          >
            上一步
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={submitting}
            onClick={nextStep}
          >
            {submitting ? '正在上传并解析…' : step === 4 ? '解析输出模板' : '下一步'}
          </button>
        </footer>
      </div>
    </div>
  );
}
