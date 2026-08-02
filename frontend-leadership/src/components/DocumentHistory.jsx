function formatTime(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return '';
  }
}

export default function DocumentHistory({ documents, activeDocumentId, onOpen, onDelete }) {
  return (
    <section className="panel document-history" aria-label="本地历史文稿">
      <div className="panel-heading"><div><p className="eyebrow">本地历史</p><h2>最近文稿</h2></div></div>
      {documents.length === 0 ? <p className="empty-compact">成功生成的文稿会保存在此浏览器中。</p> : (
        <div className="history-list">
          {documents.map((document) => (
            <div key={document.id} className={`history-item ${document.id === activeDocumentId ? 'is-active' : ''}`}>
              <button type="button" onClick={() => onOpen(document)}>
                <strong>{document.title || '未命名文稿'}</strong>
                <span>{document.profileSnapshot?.name || '未指定身份'} · {formatTime(document.updatedAt || document.createdAt)}</span>
              </button>
              <button type="button" className="delete-button" onClick={() => onDelete(document.id)} aria-label={`删除${document.title || '文稿'}`}>×</button>
            </div>
          ))}
        </div>
      )}
      <p className="browser-warning">重要提醒：文稿仅保存在当前浏览器。清除浏览器数据或更换设备后无法恢复。</p>
    </section>
  );
}
