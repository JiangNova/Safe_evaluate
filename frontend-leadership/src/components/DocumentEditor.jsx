import { useState } from 'react';

export default function DocumentEditor({ document, isWorking, onContentChange, onRegenerate, onRevise, onCopy, onDownload }) {
  const [instruction, setInstruction] = useState('');
  if (!document) {
    return (
      <section className="panel document-editor empty-editor">
        <p className="eyebrow">生成结果</p>
        <h2>生成文稿初稿</h2>
        <p>选择身份、任务并补充具体要求后，即可在这里查看和编辑初稿。</p>
      </section>
    );
  }

  const submitRevision = async () => {
    const value = instruction.trim();
    if (!value) return;
    await onRevise(value);
    setInstruction('');
  };

  return (
    <section className="panel document-editor" aria-label="文稿编辑器">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">生成结果</p>
          <h2>生成文稿初稿</h2>
        </div>
        <input className="document-title" value={document.title || ''} aria-label="文稿标题" onChange={(event) => onContentChange({ ...document, title: event.target.value })} />
      </div>
      {document.warnings?.length > 0 && (
        <div className="warning-box">请核实：{document.warnings.join('；')}</div>
      )}
      <textarea
        className="markdown-editor"
        aria-label="文稿正文"
        value={document.contentMarkdown || ''}
        onChange={(event) => onContentChange({ ...document, contentMarkdown: event.target.value })}
      />
      <div className="revision-row">
        <input value={instruction} placeholder="例如：语气更凝练，补充责任分工" onChange={(event) => setInstruction(event.target.value)} />
        <button type="button" className="secondary-button" disabled={isWorking || !instruction.trim()} onClick={submitRevision}>按要求改写</button>
      </div>
      <div className="actions document-actions">
        <button type="button" className="primary-button" disabled={isWorking} onClick={onRegenerate}>{isWorking ? '正在生成…' : '重新生成全文'}</button>
        <button type="button" className="secondary-button" onClick={onCopy}>复制全文</button>
        <button type="button" className="secondary-button" disabled={isWorking} onClick={onDownload}>下载 Word</button>
      </div>
    </section>
  );
}
