import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import FileSection from '../components/FileSection';
import ResourcePicker from '../components/ResourcePicker';
import ScenarioCard from '../components/ScenarioCard';
import {
  addJobTextResource,
  createAssetFileVersion,
  createAssetTextVersion,
  createCustomWorkspaceJob,
  createScenarioJob,
  createWorkspaceAsset,
  listWorkspaceAssets,
  listWorkspaceScenarios,
  uploadJobFiles,
  uploadJobTemplates,
} from '../services/api';
import { saveJobSession } from '../services/jobSession';
import styles from '../App.module.css';

export default function WorkspaceNewJobPage() {
  const { workspaceId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState(searchParams.get('scenario') ? 'scenario' : 'custom');
  const [scenarios, setScenarios] = useState([]);
  const [assets, setAssets] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [goal, setGoal] = useState('');
  const [materials, setMaterials] = useState([]);
  const [bases, setBases] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([listWorkspaceAssets(workspaceId), listWorkspaceScenarios(workspaceId)])
      .then(([assetResponse, scenarioResponse]) => {
        setAssets(assetResponse.data);
        setScenarios(scenarioResponse.data);
        const requested = Number(searchParams.get('scenario'));
        if (requested) setSelectedScenario(scenarioResponse.data.find((item) => item.id === requested) || null);
      })
      .catch((requestError) => setError(requestError.response?.data?.detail?.message || requestError.message));
  }, [workspaceId]);

  const basisAssets = useMemo(() => assets.filter((item) => item.asset_type === 'basis' && item.current_version_id), [assets]);
  const templateAssets = useMemo(() => assets.filter((item) => item.asset_type === 'template' && item.current_version_id), [assets]);

  async function persistItem(kind, item) {
    const asset = await createWorkspaceAsset(workspaceId, { asset_type: kind, name: item.name, description: '', tags: [] });
    if (item.source === 'upload') {
      const version = await createAssetFileVersion(workspaceId, asset.data.id, item.file);
      return version.data.id;
    }
    const version = await createAssetTextVersion(workspaceId, asset.data.id, {
      source_kind:
        kind === 'template' && /^\s*[^：:\n]{1,40}[：:]\s*(?:[_＿]{2,}|\{\{)/m.test(item.text)
          ? 'text_structured'
          : 'text_freeform',
      source_text: item.text,
    });
    return version.data.id;
  }

  async function prepareResources(kind, items) {
    const versionIds = items.filter((item) => item.source === 'workspace').map((item) => item.versionId);
    for (const item of items.filter((candidate) => candidate.saveToWorkspace)) {
      versionIds.push(await persistItem(kind, item));
    }
    return versionIds;
  }

  async function uploadTemporaryResources(jobId, kind, items) {
    const temporary = items.filter((item) => item.source !== 'workspace' && !item.saveToWorkspace);
    const files = temporary.filter((item) => item.source === 'upload').map((item) => item.file);
    if (files.length) {
      if (kind === 'template') await uploadJobTemplates(jobId, files);
      else await uploadJobFiles(jobId, kind, files);
    }
    for (const item of temporary.filter((candidate) => candidate.source === 'text')) {
      await addJobTextResource(jobId, kind, item.text, item.name);
    }
  }

  async function submit() {
    if (!materials.length) return setError('请至少上传一份待评估材料');
    if (mode === 'scenario' && !selectedScenario) return setError('请选择一个固定场景');
    if (mode === 'custom' && (!goal.trim() || !bases.length || !templates.length)) return setError('请填写评估目标，并至少提供一项评估标准和输出模板');
    setPending(true);
    setError('');
    try {
      let response;
      if (mode === 'scenario') {
        response = await createScenarioJob(workspaceId, selectedScenario.id);
      } else {
        const basisVersionIds = await prepareResources('basis', bases);
        const templateVersionIds = await prepareResources('template', templates);
        response = await createCustomWorkspaceJob(workspaceId, goal.trim(), basisVersionIds, templateVersionIds);
      }
      const { job_id: jobId, access_token: token, expires_at: expiresAt } = response.data;
      saveJobSession(jobId, token, expiresAt);
      await uploadJobFiles(jobId, 'material', materials);
      if (mode === 'custom') {
        await uploadTemporaryResources(jobId, 'basis', bases);
        await uploadTemporaryResources(jobId, 'template', templates);
      }
      navigate(`/jobs/${jobId}/templates`);
    } catch (requestError) {
      setError(requestError.response?.data?.detail?.message || requestError.message || '评估任务创建失败');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.flowPage}>
      <header className={styles.compactHeader}><div><p>NEW EVALUATION</p><h1>新建评估</h1></div><button className={styles.secondaryButton} onClick={() => navigate(`/workspace/${workspaceId}/library`)}>返回资源库</button></header>
      <div className={styles.jobModeCards}>
        <button className={mode === 'scenario' ? styles.activeJobMode : ''} onClick={() => setMode('scenario')}><strong>使用固定场景</strong><span>直接复用已保存的目标、标准和模板</span></button>
        <button className={mode === 'custom' ? styles.activeJobMode : ''} onClick={() => setMode('custom')}><strong>自定义新评估</strong><span>自由组合工作区、临时文件和文字内容</span></button>
      </div>

      {mode === 'scenario' ? <section><div className={styles.scenarioGrid}>{scenarios.map((scenario) => <ScenarioCard key={scenario.id} scenario={scenario} selected={selectedScenario?.id === scenario.id} onSelect={setSelectedScenario} />)}</div></section> : <section className={styles.customJobForm}>
        <label className={styles.goalLabel}>评估目标<textarea value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="说明需要判断什么，以及期望得到怎样的结果" /></label>
        <div><h2>评估标准</h2><p>可混合选择长期资源、临时文件和文字输入。</p><ResourcePicker kind="basis" assets={basisAssets} value={bases} onChange={setBases} /></div>
        <div><h2>输出模板</h2><p>可上传 Word/PDF，也可直接用文字描述输出结构。</p><ResourcePicker kind="template" assets={templateAssets} value={templates} onChange={setTemplates} /></div>
      </section>}

      <div className={styles.materialPanel}><FileSection kind="material" title="待评估材料" description="上传图片、PDF 或 Word 文档；这些材料只在本次任务中保留 24 小时。" accept=".png,.jpg,.jpeg,.webp,.pdf,.docx" files={materials} onChange={setMaterials} /></div>
      {error && <div className={styles.flowError}>{error}</div>}
      <footer className={styles.wizardActions}><button className={styles.primaryButton} disabled={pending} onClick={submit}>{pending ? '正在创建并上传…' : '继续解析模板'}</button></footer>
    </div>
  );
}
