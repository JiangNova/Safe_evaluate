import { useId, useRef, useState } from 'react';
import styles from '../App.module.css';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

function acceptedExtensions(accept) {
  return new Set(
    String(accept || '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.startsWith('.')),
  );
}

export default function FileSection({
  kind,
  title,
  description,
  accept,
  files,
  onChange,
}) {
  const inputId = useId();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState('');

  function mergeFiles(selectedFiles) {
    const selected = Array.from(selectedFiles || []);
    const allowed = acceptedExtensions(accept);
    const invalidType = selected.find((file) => {
      const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
      return allowed.size > 0 && !allowed.has(extension);
    });
    if (invalidType) {
      setFileError(`不支持“${invalidType.name}”的文件格式`);
      return;
    }
    const oversized = selected.find((file) => file.size > MAX_FILE_SIZE);
    if (oversized) {
      setFileError(`“${oversized.name}”超过 50MB，请压缩后重试`);
      return;
    }
    const known = new Set(files.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
    onChange([
      ...files,
      ...selected.filter(
        (file) => !known.has(`${file.name}:${file.size}:${file.lastModified}`),
      ),
    ]);
    setFileError('');
  }

  function addFiles(event) {
    mergeFiles(event.target.files);
    event.target.value = '';
  }

  function dropFiles(event) {
    event.preventDefault();
    setDragging(false);
    mergeFiles(event.dataTransfer.files);
  }

  function openFilePicker() {
    inputRef.current?.click();
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

      <div
        className={`${styles.dropzone} ${dragging ? styles.dropzoneDragging : ''}`}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
        }}
        onDrop={dropFiles}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          multiple
          onChange={addFiles}
        />
        <strong>{dragging ? '松开即可添加文件' : '将文件拖到这里'}</strong>
        <span>或者</span>
        <button type="button" className={styles.filePickerButton} onClick={openFilePicker}>
          选择文件
        </button>
        <small>支持多选，单个文件不超过 50MB</small>
      </div>

      {fileError && <div className={styles.fileError}>{fileError}</div>}

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
