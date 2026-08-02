import styles from '../App.module.css';

export default function PdfPlacementEditor({ locator = {}, onChange }) {
  const rect = locator.rect || [0, 0, 100, 30];
  function patchRect(index, value) {
    const next = [...rect];
    next[index] = Number(value);
    onChange({ ...locator, rect: next });
  }
  return (
    <div className={styles.pdfPlacementEditor}>
      <strong>填写区域</strong>
      <label>页码<input type="number" min="1" value={(locator.page || 0) + 1} onChange={(event) => onChange({ ...locator, page: Math.max(0, Number(event.target.value) - 1) })} /></label>
      {['左', '下', '右', '上'].map((label, index) => <label key={label}>{label}<input type="number" value={rect[index]} onChange={(event) => patchRect(index, event.target.value)} /></label>)}
      <label>字号<input type="number" min="6" max="36" value={locator.font_size || 10} onChange={(event) => onChange({ ...locator, font_size: Number(event.target.value) })} /></label>
      <label>对齐方式<select value={locator.alignment || 'left'} onChange={(event) => onChange({ ...locator, alignment: event.target.value })}><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select></label>
      <label className={styles.checkRow}><input type="checkbox" checked={Boolean(locator.confirmed)} onChange={(event) => onChange({ ...locator, confirmed: event.target.checked })} />确认此位置</label>
    </div>
  );
}
