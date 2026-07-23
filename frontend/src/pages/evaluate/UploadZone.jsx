import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import styles from './UploadZone.module.css';

export default function UploadZone({ files, onFilesChange }) {
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        onFilesChange([...files, ...acceptedFiles]);
      }
    },
    [files, onFilesChange]
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
    onDropAccepted: () => setIsDragging(false),
    onDropRejected: () => setIsDragging(false),
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'],
      'application/pdf': ['.pdf'],
    },
    maxSize: 50 * 1024 * 1024,
    multiple: true,
  });

  function removeFile(index) {
    const next = files.filter((_, i) => i !== index);
    onFilesChange(next.length === 0 ? [] : next);
  }

  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  const hasFiles = files.length > 0;

  return (
    <div
      {...getRootProps()}
      className={`${styles.zone} ${isDragging ? styles.dragging : ''} ${hasFiles ? styles.hasFile : ''}`}
    >
      <input {...getInputProps()} />
      <div className={styles.icon}>{hasFiles ? '📸' : '🏗️'}</div>

      {hasFiles ? (
        <>
          <div className={styles.title}>
            已选择 {files.length} 个文件
          </div>
          <div className={styles.fileList}>
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} className={styles.fileRow}>
                <span className={styles.fileName}>{f.name}</span>
                <span className={styles.fileSize}>{formatSize(f.size)}</span>
                <span
                  className={styles.removeBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(i);
                  }}
                >
                  ✕
                </span>
              </div>
            ))}
          </div>
          <div className={styles.formats}>
            点击或拖拽继续添加更多文件
          </div>
        </>
      ) : (
        <>
          <div className={styles.title}>上传消防评估资料</div>
          <div className={styles.hint}>
            支持同时上传多张图片 — 建筑平面图 · 消防设施布局图 · 疏散路线图 · 现场照片
          </div>
          <div className={styles.formats}>
            支持 PNG / JPG / WebP / PDF · 单文件最大 50MB · 可多选
          </div>
        </>
      )}
    </div>
  );
}
