import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import styles from './UploadZone.module.css';

export default function UploadZone({ file, onFileChange }) {
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        onFileChange(acceptedFiles[0]);
      }
    },
    [onFileChange]
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
    onDropAccepted: () => setIsDragging(false),
    onDropRejected: () => setIsDragging(false),
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp'],
      'application/pdf': ['.pdf'],
    },
    maxSize: 50 * 1024 * 1024,
    multiple: false,
  });

  return (
    <div
      {...getRootProps()}
      className={`${styles.zone} ${isDragging ? styles.dragging : ''} ${file ? styles.hasFile : ''}`}
    >
      <input {...getInputProps()} />
      <div className={styles.icon}>🏗️</div>
      {file ? (
        <>
          <div className={styles.title}>已选择文件</div>
          <div className={styles.fileInfo}>{file.name}</div>
          <div className={styles.formats}>
            {(file.size / 1024 / 1024).toFixed(1)} MB
          </div>
          <span
            className={styles.removeBtn}
            onClick={(e) => {
              e.stopPropagation();
              onFileChange(null);
            }}
          >
            移除文件
          </span>
        </>
      ) : (
        <>
          <div className={styles.title}>上传消防评估资料</div>
          <div className={styles.hint}>
            建筑平面图 · 消防设施布局图 · 疏散路线图
          </div>
          <div className={styles.formats}>
            支持 PNG / JPG / PDF · 最大 50MB
          </div>
        </>
      )}
    </div>
  );
}
