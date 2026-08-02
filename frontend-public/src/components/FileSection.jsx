import { useId } from 'react';
import styles from '../App.module.css';

export default function FileSection({
  kind,
  title,
  description,
  accept,
  files,
  onChange,
}) {
  const inputId = useId();

  function addFiles(event) {
    const selected = Array.from(event.target.files || []);
    const known = new Set(files.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
    onChange([
      ...files,
      ...selected.filter(
        (file) => !known.has(`${file.name}:${file.size}:${file.lastModified}`),
      ),
    ]);
    event.target.value = '';
  }

  function removeFile(index) {
    onChange(files.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <section className={styles.fileSection} data-kind={kind}>
      <div className={styles.sectionTitle}>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span>{files.length} 个文件</span>
      </div>

      <label className={styles.dropzone} htmlFor={inputId}>
        <input
          id={inputId}
          type="file"
          accept={accept}
          multiple
          onChange={addFiles}
        />
        <strong>选择或拖入文件</strong>
        <small>单个文件不超过 50MB</small>
      </label>

      {files.length > 0 && (
        <ul className={styles.fileList}>
          {files.map((file, index) => (
            <li key={`${file.name}-${file.lastModified}`}>
              <span>
                <strong>{file.name}</strong>
                <small>{(file.size / 1024 / 1024).toFixed(2)} MB</small>
              </span>
              <button type="button" onClick={() => removeFile(index)}>
                移除
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

