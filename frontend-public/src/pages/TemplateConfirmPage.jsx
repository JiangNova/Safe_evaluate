import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import StepIndicator from '../components/StepIndicator';
import TemplateFieldEditor from '../components/TemplateFieldEditor';
import { confirmTemplateFields, getPublicJob, startPublicEvaluation } from '../services/api';
import styles from '../App.module.css';

const STEPS = ['评估说明', '待评估材料', '评估依据', '输出模板', '字段确认', '生成与校核'];

export default function TemplateConfirmPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getPublicJob(jobId)
      .then(({ data }) => {
        if (cancelled) return;
        setJob(data);
        setDrafts(Object.fromEntries(data.templates.map((template) => [template.id, template.fields || []])));
        setActiveId(data.templates[0]?.id || null);
      })
      .catch((requestError) => setError(requestError.response?.data?.detail?.message || requestError.message))
      .finally(() => setLoading(false));
    return () => { cancelled = true; };
  }, [jobId]);

  const activeTemplate = useMemo(
    () => job?.templates.find((template) => template.id === activeId),
    [job, activeId],
  );

  async function confirmAndEvaluate() {
    setSubmitting(true);
    setError('');
    try {
      for (const template of job.templates) {
        const fields = drafts[template.id] || [];
        if (fields.length === 0) throw new Error(`模板 ${template.id} 至少需要一个字段`);
        await confirmTemplateFields(
          jobId,
          template.id,
          fields,
          template.preview_metadata,
        );
      }
      await startPublicEvaluation(jobId);
      navigate(`/jobs/${jobId}/workspace`);
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail?.message || requestError.message || '字段确认失败',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className={styles.flowState}>正在加载模板解析结果…</div>;
  if (error && !job) return <div className={styles.flowError}>{error}</div>;

  return (
    <div className={styles.flowPage}>
      <header className={styles.compactHeader}>
        <div><p>TEMPLATE MAPPING</p><h1>确认输出模板字段</h1></div>
        <span>低置信度字段必须人工核对；PDF 可调整页码和填写坐标。</span>
      </header>
      <StepIndicator steps={STEPS} current={5} />

      <div className={styles.templateTabs}>
        {job.templates.map((template, index) => (
          <button
            type="button"
            key={template.id}
            className={template.id === activeId ? styles.activeTab : ''}
            onClick={() => setActiveId(template.id)}
          >
            模板 {index + 1} · {template.source_format.toUpperCase()}
            <small>{(drafts[template.id] || []).length} 个字段</small>
          </button>
        ))}
      </div>

      {activeTemplate && (
        <div className={styles.confirmLayout}>
          <aside className={styles.templatePreview}>
            <h2>结构预览</h2>
            {(activeTemplate.preview_metadata?.warnings || []).map((warning) => (
              <p className={styles.previewWarning} key={warning}>{warning}</p>
            ))}
            {activeTemplate.source_format === 'docx' ? (
              <div className={styles.previewDocument}>
                {(activeTemplate.preview_metadata?.paragraphs || []).slice(0, 60).map((item, index) => (
                  <p key={`${item.path}-${index}`}>{item.text}</p>
                ))}
              </div>
            ) : (
              <div className={styles.previewDocument}>
                {(activeTemplate.preview_metadata?.pages || []).map((page) => (
                  <section key={page.page}>
                    <strong>第 {page.page + 1} 页</strong>
                    {page.blocks?.slice(0, 30).map((block, index) => <p key={index}>{block.text}</p>)}
                  </section>
                ))}
              </div>
            )}
          </aside>
          <main className={styles.fieldEditorPane}>
            <TemplateFieldEditor
              fields={drafts[activeId] || []}
              sourceFormat={activeTemplate.source_format}
              onChange={(fields) => setDrafts((current) => ({ ...current, [activeId]: fields }))}
            />
          </main>
        </div>
      )}

      {error && <div className={styles.flowError}>{error}</div>}
      <div className={styles.confirmFooter}>
        <button className={styles.secondaryButton} type="button" onClick={() => navigate('/')}>
          重新创建任务
        </button>
        <button className={styles.primaryButton} type="button" disabled={submitting} onClick={confirmAndEvaluate}>
          {submitting ? '正在确认并启动评估…' : '确认字段并开始评估'}
        </button>
      </div>
    </div>
  );
}

