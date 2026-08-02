import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createAssetFileVersion,
  createAssetTextVersion,
  createWorkspaceAsset,
  createWorkspaceScenario,
  deleteWorkspaceAsset,
  deleteWorkspaceScenario,
  getWorkspace,
  listAssetVersions,
  listWorkspaceAssets,
  listWorkspaceScenarios,
} from '../services/api';
import { clearWorkspaceSession } from '../services/workspaceSession';
import styles from '../App.module.css';

const TABS = [
  { key: 'basis', label: '评估标准' },
  { key: 'template', label: '输出模板' },
  { key: 'scenario', label: '固定场景' },
];

export default function WorkspaceLibraryPage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(null);
  const [tab, setTab] = useState('basis');
  const [assets, setAssets] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [search, setSearch] = useState('');
  const [versions, setVersions] = useState({});
  const [formOpen, setFormOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      const [workspaceResponse, assetResponse, scenarioResponse] = await Promise.all([
        getWorkspace(workspaceId),
        listWorkspaceAssets(workspaceId),
        listWorkspaceScenarios(workspaceId),
      ]);
      setWorkspace(workspaceResponse.data);
      setAssets(assetResponse.data);
      setScenarios(scenarioResponse.data);
    } catch (requestError) {
      setError(requestError.response?.data?.detail?.message || requestError.message);
    }
  }

  useEffect(() => { load(); }, [workspaceId]);

  const visibleItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const source = tab === 'scenario' ? scenarios : assets.filter((item) => item.asset_type === tab);
    if (!needle) return source;
    return source.filter((item) => `${item.name} ${item.description || ''} ${(item.tags || []).join(' ')}`.toLowerCase().includes(needle));
  }, [assets, scenarios, search, tab]);

  async function showVersions(assetId) {
    if (versions[assetId]) {
      setVersions((current) => ({ ...current, [assetId]: null }));
      return;
    }
    const response = await listAssetVersions(workspaceId, assetId);
    setVersions((current) => ({ ...current, [assetId]: response.data }));
  }

  async function removeItem(item) {
    if (!window.confirm(`确定移除“${item.name}”吗？历史评估快照不会受影响。`)) return;
    if (tab === 'scenario') await deleteWorkspaceScenario(workspaceId, item.id);
    else await deleteWorkspaceAsset(workspaceId, item.id);
    await load();
  }

  async function submitResource(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError('');
    try {
      if (tab === 'scenario') {
        await createWorkspaceScenario(workspaceId, {
          name: data.get('name'),
          description: data.get('description') || '',
          goal_template: data.get('goal'),
          basis_version_ids: data.getAll('basisVersions').map(Number),
          template_version_ids: data.getAll('templateVersions').map(Number),
        });
      } else {
        const created = await createWorkspaceAsset(workspaceId, {
          asset_type: tab,
          name: data.get('name'),
          description: data.get('description') || '',
          tags: String(data.get('tags') || '').split(/[，,]/).map((item) => item.trim()).filter(Boolean),
        });
        const file = data.get('file');
        const text = String(data.get('text') || '').trim();
        if (file?.size) await createAssetFileVersion(workspaceId, created.data.id, file);
        else await createAssetTextVersion(workspaceId, created.data.id, {
          source_kind: 'text_freeform',
          source_text: text,
        });
      }
      setFormOpen(false);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.detail?.message || requestError.message || '保存失败');
    } finally {
      setPending(false);
    }
  }

  const basisVersions = assets.filter((item) => item.asset_type === 'basis' && item.current_version_id);
  const templateVersions = assets.filter((item) => item.asset_type === 'template' && item.current_version_id);

  return (
    <div className={styles.libraryPage}>
      <header className={styles.libraryHeader}>
        <div><p className={styles.eyebrow}>WORKSPACE LIBRARY</p><h1>{workspace?.name || '长期工作区'}</h1><span>工作区 ID：{workspaceId}</span></div>
        <div className={styles.inlineActions}>
          <button className={styles.secondaryButton} onClick={() => navigate(`/workspace/${workspaceId}/new`)}>新建评估</button>
          <button className={styles.secondaryButton} onClick={() => { clearWorkspaceSession(workspaceId); navigate('/workspace'); }}>退出工作区</button>
        </div>
      </header>

      <nav className={styles.libraryTabs}>
        {TABS.map((item) => <button key={item.key} className={tab === item.key ? styles.activeLibraryTab : ''} onClick={() => setTab(item.key)}>{item.label}</button>)}
      </nav>

      <div className={styles.libraryToolbar}>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索名称、说明或标签" />
        <button className={styles.primaryButton} onClick={() => setFormOpen(true)}>新增{TABS.find((item) => item.key === tab)?.label}</button>
      </div>
      {error && <div className={styles.flowError}>{error}</div>}

      <section className={styles.resourceGrid}>
        {visibleItems.map((item) => (
          <article className={styles.resourceCard} key={`${tab}-${item.id}`}>
            <div className={styles.resourceCardTop}><span>{tab === 'basis' ? 'STANDARD' : tab === 'template' ? 'TEMPLATE' : 'SCENARIO'}</span><button onClick={() => removeItem(item)}>移除</button></div>
            <h2>{item.name}</h2><p>{item.description || '暂无说明'}</p>
            {item.tags?.length > 0 && <div className={styles.tagList}>{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
            {tab === 'scenario' ? (
              <button className={styles.primaryButton} onClick={() => navigate(`/workspace/${workspaceId}/new?scenario=${item.id}`)}>开始评估</button>
            ) : (
              <button className={styles.textButton} onClick={() => showVersions(item.id)}>版本记录</button>
            )}
            {versions[item.id] && <ol className={styles.versionList}>{versions[item.id].map((version) => <li key={version.id}>V{version.version_number} · {version.original_name || '文字输入'} · {new Date(version.created_at).toLocaleDateString()}</li>)}</ol>}
          </article>
        ))}
        {!visibleItems.length && <div className={styles.emptyLibrary}>这里还没有内容。新增后即可在每次评估中直接复用。</div>}
      </section>

      {formOpen && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <form className={styles.resourceDialog} onSubmit={submitResource}>
            <h2>新增{TABS.find((item) => item.key === tab)?.label}</h2>
            <div className={styles.formStack}>
              <label>名称<input name="name" required maxLength={160} /></label>
              <label>说明<textarea name="description" /></label>
              {tab === 'scenario' ? <>
                <label>评估目标<textarea name="goal" required placeholder="描述需要判断什么、输出什么" /></label>
                <fieldset><legend>选择评估标准</legend>{basisVersions.map((item) => <label className={styles.checkRow} key={item.id}><input type="checkbox" name="basisVersions" value={item.current_version_id} />{item.name}</label>)}</fieldset>
                <fieldset><legend>选择输出模板</legend>{templateVersions.map((item) => <label className={styles.checkRow} key={item.id}><input type="checkbox" name="templateVersions" value={item.current_version_id} />{item.name}</label>)}</fieldset>
              </> : <>
                <label>标签<input name="tags" placeholder="用逗号分隔" /></label>
                <label>上传文件<input name="file" type="file" accept={tab === 'basis' ? '.pdf,.docx,.txt' : '.pdf,.docx'} /></label>
                <div className={styles.orDivider}>或使用文字输入</div>
                <label>{tab === 'basis' ? '标准内容' : '输出格式说明'}<textarea name="text" placeholder={tab === 'basis' ? '粘贴制度、规则或判断标准' : '例如：依次输出事实摘要、适用依据、结论和建议'} /></label>
              </>}
            </div>
            <footer className={styles.modalActions}><button type="button" className={styles.secondaryButton} onClick={() => setFormOpen(false)}>取消</button><button className={styles.primaryButton} disabled={pending}>{pending ? '保存中…' : '保存'}</button></footer>
          </form>
        </div>
      )}
    </div>
  );
}
