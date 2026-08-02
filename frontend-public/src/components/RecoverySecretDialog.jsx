import { useState } from 'react';
import styles from '../App.module.css';

export default function RecoverySecretDialog({ workspace, token, onConfirm, onCancel }) {
  const [acknowledged, setAcknowledged] = useState(false);

  async function copySecret() {
    await navigator.clipboard.writeText(`${workspace.workspace_id}\n${token}`);
  }

  function downloadSecret() {
    const content = [
      '通用自动评估平台工作区恢复信息',
      `工作区名称：${workspace.name || '未命名工作区'}`,
      `工作区 ID：${workspace.workspace_id}`,
      `恢复码：${token}`,
      '请妥善保存。恢复码遗失后无法找回。',
    ].join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `工作区恢复信息-${workspace.workspace_id}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
      <section className={styles.secretDialog}>
        <p className={styles.eyebrow}>RECOVERY KEY</p>
        <h2>请保存工作区恢复信息</h2>
        <p>恢复码只在本次创建时完整显示。以后换设备或清除浏览器数据时，需要工作区 ID 和恢复码才能进入。</p>
        <dl className={styles.secretGrid}>
          <div><dt>工作区 ID</dt><dd>{workspace.workspace_id}</dd></div>
          <div><dt>恢复码</dt><dd>{token}</dd></div>
        </dl>
        <div className={styles.inlineActions}>
          <button type="button" className={styles.secondaryButton} onClick={copySecret}>复制</button>
          <button type="button" className={styles.secondaryButton} onClick={downloadSecret}>下载恢复信息</button>
        </div>
        <label className={styles.confirmCheck}>
          <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
          我已保存恢复码，同意将访问凭证保存在当前浏览器
        </label>
        <footer className={styles.modalActions}>
          <button type="button" className={styles.secondaryButton} onClick={onCancel}>暂不进入</button>
          <button type="button" className={styles.primaryButton} disabled={!acknowledged} onClick={onConfirm}>进入资源库</button>
        </footer>
      </section>
    </div>
  );
}
