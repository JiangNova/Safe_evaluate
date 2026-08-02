import styles from '../App.module.css';

export default function PlacementEditor({ locator, sourceFormat }) {
  const kind = locator?.kind || (sourceFormat === 'pdf' ? 'pdf_rect' : 'anchor');
  return (
    <div className={styles.statusPanel}>
      <strong>填写位置</strong>
      <span>{kind === 'pdf_rect' ? `PDF 第 ${(locator?.page || 0) + 1} 页坐标区域` : locator?.anchor || locator?.placeholder || '结构化位置'}</span>
    </div>
  );
}
