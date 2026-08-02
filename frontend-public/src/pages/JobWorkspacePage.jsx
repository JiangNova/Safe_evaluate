import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DocumentFieldEditor from '../components/DocumentFieldEditor';
import StepIndicator from '../components/StepIndicator';
import ApplicabilityPanel from '../components/ApplicabilityPanel';
import QualityGatePanel from '../components/QualityGatePanel';
import {
  downloadArtifact,
  downloadArtifactArchive,
  finalizeDocument,
  getPublicJob,
  regenerateDocumentField,
  renderDocumentDraft,
  updateDocumentFields,
} from '../services/api';
import styles from '../App.module.css';

const STEPS = ['评估说明', '待评估材料', '评估依据', '输出模板', '字段确认', '生成与校核'];
const ACTIVE = new Set(['evaluating', 'mapping', 'finalizing']);

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function JobWorkspacePage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [activeDocumentId, setActiveDocumentId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [dirtyDocumentId, setDirtyDocumentId] = useState(null);
  const [regeneratingKey, setRegeneratingKey] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const pollingRef = useRef(null);

  async function loadJob() {
    try {
      const { data } = await getPublicJob(jobId);
      setJob(data);
      setDrafts((current) => {
        const next = { ...current };
        data.documents.forEach((documentItem) => {
          if (!next[documentItem.id]) next[documentItem.id] = documentItem.current_fields || {};
        });
        return next;
      });
      setActiveDocumentId((current) => current || data.documents[0]?.id || null);
      setError('');
      if (ACTIVE.has(data.status)) {
        pollingRef.current = window.setTimeout(loadJob, 2000);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.detail?.message || requestError.message);
    }
  }

  useEffect(() => {
    loadJob();
    return () => window.clearTimeout(pollingRef.current);
  }, [jobId]);

  useEffect(() => {
    if (!dirtyDocumentId || !drafts[dirtyDocumentId]) return undefined;
    const timeout = window.setTimeout(async () => {
      setSaving(true);
      try {
        await updateDocumentFields(jobId, dirtyDocumentId, drafts[dirtyDocumentId]);
        setDirtyDocumentId(null);
      } catch (requestError) {
        setError(requestError.response?.data?.detail?.message || requestError.message);
      } finally {
        setSaving(false);
      }
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [jobId, dirtyDocumentId, drafts]);

  const activeDocument = useMemo(
    () => job?.documents.find((item) => item.id === activeDocumentId),
    [job, activeDocumentId],
  );
  const activeTemplate = useMemo(
    () => job?.templates.find((item) => item.id === activeDocument?.template_id),
    [job, activeDocument],
  );

  function changeDraft(fields) {
    setDrafts((current) => ({ ...current, [activeDocumentId]: fields }));
    setDirtyDocumentId(activeDocumentId);
  }

  async function regenerate(fieldKey) {
    setRegeneratingKey(fieldKey);
    try {
      const { data } = await regenerateDocumentField(jobId, activeDocumentId, fieldKey);
      setDrafts((current) => ({ ...current, [activeDocumentId]: data.current_fields }));
      setJob((current) => ({
        ...current,
        documents: current.documents.map((item) => (item.id === data.id ? data : item)),
      }));
    } catch (requestError) {
      setError(requestError.response?.data?.detail?.message || requestError.message);
    } finally {
      setRegeneratingKey('');
    }
  }

  function restore(fieldKey, initialValue) {
    if (!initialValue) return;
    changeDraft({ ...drafts[activeDocumentId], [fieldKey]: initialValue });
  }

  async function finalize() {
    try {
      if (dirtyDocumentId === activeDocumentId) {
        await updateDocumentFields(jobId, activeDocumentId, drafts[activeDocumentId]);
        setDirtyDocumentId(null);
      }
      await finalizeDocument(jobId, activeDocumentId);
      await loadJob();
    } catch (requestError) {
      setError(requestError.response?.data?.detail?.message || requestError.message);
    }
  }

  async function renderDraft() {
    try {
      if (dirtyDocumentId === activeDocumentId) {
        await updateDocumentFields(jobId, activeDocumentId, drafts[activeDocumentId]);
        setDirtyDocumentId(null);
      }
      const response = await renderDocumentDraft(jobId, activeDocumentId);
      const fileId = response.data.file.id;
      const fileResponse = await downloadArtifact(jobId, fileId);
      saveBlob(fileResponse.data, response.data.file.name || '文书草稿.docx');
      await loadJob();
    } catch (requestError) {
      setError(requestError.response?.data?.detail?.message || requestError.message);
    }
  }

  async function download(fileId, filename) {
    const response = await downloadArtifact(jobId, fileId);
    saveBlob(response.data, filename);
  }

  async function downloadAll() {
    try {
      const response = await downloadArtifactArchive(jobId);
      saveBlob(response.data, '全部输出文书.zip');
    } catch (requestError) {
      setError(requestError.response?.data?.detail?.message || requestError.message);
    }
  }

  if (!job && !error) return <div className={styles.flowState}>正在读取评估任务…</div>;
  if (!job) return <div className={styles.flowError}>{error}</div>;

  const expiresAt = new Date(job.expires_at).toLocaleString('zh-CN');
  const waiting = ACTIVE.has(job.status) || (job.status === 'evaluating' && job.documents.length === 0);

  return (
    <div className={styles.flowPage}>
      <header className={styles.compactHeader}>
        <div><p>DOCUMENT WORKSPACE</p><h1>{job.result?.title || '评估生成与文书校核'}</h1></div>
        <span>任务将于 {expiresAt} 自动清理</span>
      </header>
      <StepIndicator steps={STEPS} current={6} />

      {waiting && (
        <div className={styles.processingCard}>
          <span className={styles.spinner} />
          <div><h2>正在生成评估结果和模板字段</h2><p>当前阶段：{job.status}</p></div>
        </div>
      )}

      {job.status === 'failed' && (
        <div className={styles.flowError}>
          {job.errors?.message || '评估失败，请根据提示重新创建任务。'}
        </div>
      )}

      {job.result && (
        <section className={styles.resultSummary}>
          <div><span>总体结论</span><strong>{job.result.overall_result}</strong></div>
          <p>{job.result.executive_summary}</p>
          {job.result.limitations?.length > 0 && <small>限制：{job.result.limitations.join('；')}</small>}
        </section>
      )}

      {job.documents.length > 0 && (
        <>
          <div className={styles.documentTabs}>
            {job.documents.map((documentItem, index) => (
              <button
                type="button"
                key={documentItem.id}
                className={documentItem.id === activeDocumentId ? styles.activeTab : ''}
                onClick={() => setActiveDocumentId(documentItem.id)}
              >
                文书 {index + 1}<small>{documentItem.status}</small>
              </button>
            ))}
            <button type="button" className={styles.downloadAllButton} onClick={downloadAll}>
              下载全部文书
            </button>
          </div>

          {activeDocument && activeTemplate && (
            <div className={styles.workspaceLayout}>
              <aside className={styles.documentPreview}>
                <h2>文书预览</h2>
                <dl>
                  {activeTemplate.fields.map((field) => (
                    <div key={field.key}>
                      <dt>{field.label}</dt>
                      <dd>{String(drafts[activeDocumentId]?.[field.key]?.value ?? '')}</dd>
                    </div>
                  ))}
                </dl>
                {activeDocument.warnings?.map((warning, index) => (
                  <p className={styles.previewWarning} key={index}>{warning.message}</p>
                ))}
              </aside>
              <main className={styles.documentEditorPane}>
                <ApplicabilityPanel applicability={activeDocument.applicability} />
                <QualityGatePanel quality={activeDocument.quality} values={drafts[activeDocumentId] || {}} definitions={activeTemplate.fields} />
                <div className={styles.autosaveState}>{saving ? '正在自动保存…' : '修改将自动保存'}</div>
                <DocumentFieldEditor
                  definitions={activeTemplate.fields}
                  values={drafts[activeDocumentId] || {}}
                  initialValues={activeDocument.ai_initial_fields || {}}
                  onChange={changeDraft}
                  onRegenerate={regenerate}
                  onRestore={restore}
                  regeneratingKey={regeneratingKey}
                />
                <div className={styles.finalizeActions}>
                  <button type="button" className={styles.secondaryButton} onClick={renderDraft}>
                    生成草稿
                  </button>
                  <button type="button" className={styles.primaryButton} onClick={finalize}>
                    确认定稿
                  </button>
                  {activeDocument.docx_file_id && (
                    <button type="button" className={styles.secondaryButton} onClick={() => download(activeDocument.docx_file_id, '评估结果.docx')}>
                      下载 DOCX
                    </button>
                  )}
                  {activeDocument.pdf_file_id && (
                    <button type="button" className={styles.secondaryButton} onClick={() => download(activeDocument.pdf_file_id, '评估结果.pdf')}>
                      下载 PDF
                    </button>
                  )}
                </div>
              </main>
            </div>
          )}
        </>
      )}

      {error && <div className={styles.flowError}>{error}</div>}
      <button type="button" className={styles.textButton} onClick={() => navigate('/')}>新建另一项评估</button>
    </div>
  );
}
