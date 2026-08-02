import { useMemo, useState } from 'react';
import styles from '../App.module.css';

const MODES = [
  { key: 'workspace', label: '从工作区选择' },
  { key: 'upload', label: '临时上传' },
  { key: 'text', label: '文字输入' },
];

export default function ResourcePicker({ kind, assets, value, onChange }) {
  const [mode, setMode] = useState('workspace');
  const [text, setText] = useState('');
  const [textName, setTextName] = useState('');
  const [saveText, setSaveText] = useState(false);
  const selectedVersions = useMemo(
    () => new Set(value.filter((item) => item.source === 'workspace').map((item) => item.versionId)),
    [value],
  );

  function toggleSaved(asset) {
    if (selectedVersions.has(asset.current_version_id)) {
      onChange(value.filter((item) => item.versionId !== asset.current_version_id));
    } else {
      onChange([...value, { source: 'workspace', versionId: asset.current_version_id, name: asset.name }]);
    }
  }

  function addFiles(event) {
    const items = Array.from(event.target.files || []).map((file) => ({
      source: 'upload', file, name: file.name, saveToWorkspace: false,
    }));
    onChange([...value, ...items]);
    event.target.value = '';
  }

  function addText() {
    if (!text.trim()) return;
    onChange([...value, {
      source: 'text',
      text: text.trim(),
      name: textName.trim() || (kind === 'basis' ? '文字评估标准' : '文字输出模板'),
      saveToWorkspace: saveText,
    }]);
    setText('');
    setTextName('');
    setSaveText(false);
  }

  function patchItem(index, changes) {
    onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));
  }

  return (
    <section className={styles.resourcePicker}>
      <div className={styles.pickerModes}>
        {MODES.map((item) => <button type="button" key={item.key} className={mode === item.key ? styles.activePickerMode : ''} onClick={() => setMode(item.key)}>{item.label}</button>)}
      </div>

      {mode === 'workspace' && (
        <div className={styles.savedChoices}>
          {assets.map((asset) => <label key={asset.id}><input type="checkbox" checked={selectedVersions.has(asset.current_version_id)} onChange={() => toggleSaved(asset)} /> <span><strong>{asset.name}</strong><small>当前版本 · V{asset.current_version_id ? '已保存' : '无内容'}</small></span></label>)}
          {!assets.length && <p>工作区中还没有可选内容，可临时上传或直接输入文字。</p>}
        </div>
      )}

      {mode === 'upload' && (
        <label className={styles.compactDropzone}>
          <input type="file" multiple accept={kind === 'basis' ? '.pdf,.docx,.txt' : '.pdf,.docx'} onChange={addFiles} />
          <strong>选择{kind === 'basis' ? '评估标准' : '输出模板'}文件</strong>
          <span>{kind === 'basis' ? '支持 PDF、Word、TXT' : '支持 PDF、Word'}</span>
        </label>
      )}

      {mode === 'text' && (
        <div className={styles.textResourceForm}>
          <input value={textName} onChange={(event) => setTextName(event.target.value)} placeholder="名称（可选）" />
          <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={kind === 'basis' ? '粘贴制度、规则、处罚标准或评估依据' : '描述最终文稿应包含的栏目、顺序、格式和措辞要求'} />
          <label className={styles.checkRow}><input type="checkbox" checked={saveText} onChange={(event) => setSaveText(event.target.checked)} />保存到工作区</label>
          <button type="button" className={styles.secondaryButton} onClick={addText}>添加文字内容</button>
        </div>
      )}

      {value.length > 0 && <ul className={styles.selectedResources}>{value.map((item, index) => (
        <li key={`${item.source}-${item.versionId || item.name}-${index}`}>
          <span><strong>{item.name}</strong><small>{item.source === 'workspace' ? '工作区版本' : item.source === 'upload' ? '临时文件' : '文字输入'}</small></span>
          {item.source === 'upload' && <label className={styles.saveInline}><input type="checkbox" checked={item.saveToWorkspace} onChange={(event) => patchItem(index, { saveToWorkspace: event.target.checked })} />保存到工作区</label>}
          <button type="button" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}>移除</button>
        </li>
      ))}</ul>}
    </section>
  );
}
