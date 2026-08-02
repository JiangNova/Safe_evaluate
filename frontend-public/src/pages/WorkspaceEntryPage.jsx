import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import RecoverySecretDialog from '../components/RecoverySecretDialog';
import { createWorkspace, recoverWorkspace } from '../services/api';
import { saveWorkspaceSession } from '../services/workspaceSession';
import styles from '../App.module.css';

export default function WorkspaceEntryPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('create');
  const [name, setName] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [secret, setSecret] = useState('');
  const [created, setCreated] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      if (mode === 'create') {
        const response = await createWorkspace(name.trim());
        setCreated({ workspace: response.data, token: response.data.access_token });
      } else {
        await recoverWorkspace(workspaceId.trim(), secret.trim());
        saveWorkspaceSession(workspaceId.trim(), secret.trim(), '', true);
        navigate(`/workspace/${workspaceId.trim()}/library`);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.detail?.message || requestError.message || '操作失败，请稍后重试');
    } finally {
      setPending(false);
    }
  }

  function confirmCreated() {
    const { workspace, token } = created;
    saveWorkspaceSession(workspace.workspace_id, token, workspace.name, true);
    navigate(`/workspace/${workspace.workspace_id}/library`);
  }

  return (
    <div className={styles.workspaceEntry}>
      <section className={styles.entryIntro}>
        <p className={styles.eyebrow}>REUSABLE WORKSPACE</p>
        <h1>把常用标准和模板，留给下一次评估</h1>
        <p>无需注册账号。创建一个可恢复的长期工作区，集中保存评估标准、输出模板和固定业务场景。</p>
        <Link to="/">只做一次临时评估 →</Link>
      </section>
      <section className={styles.entryCard}>
        <div className={styles.segmented}>
          <button type="button" className={mode === 'create' ? styles.activeSegment : ''} onClick={() => setMode('create')}>创建长期工作区</button>
          <button type="button" className={mode === 'recover' ? styles.activeSegment : ''} onClick={() => setMode('recover')}>使用恢复码进入</button>
        </div>
        <form onSubmit={submit} className={styles.formStack}>
          {mode === 'create' ? (
            <label>工作区名称<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="例如：人事合规评估" /></label>
          ) : (
            <>
              <label>工作区 ID<input required value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)} /></label>
              <label>恢复码<input required type="password" value={secret} onChange={(event) => setSecret(event.target.value)} /></label>
            </>
          )}
          {error && <div className={styles.flowError}>{error}</div>}
          <button className={styles.primaryButton} disabled={pending}>{pending ? '正在处理…' : mode === 'create' ? '创建工作区' : '验证并进入'}</button>
        </form>
      </section>
      {created && (
        <RecoverySecretDialog workspace={created.workspace} token={created.token} onConfirm={confirmCreated} onCancel={() => setCreated(null)} />
      )}
    </div>
  );
}
