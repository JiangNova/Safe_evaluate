import styles from '../App.module.css';

const FIELD_TYPES = [
  ['text', '单行文本'],
  ['multiline', '多行文本'],
  ['date', '日期'],
  ['boolean', '是/否'],
  ['list', '重复列表'],
];

function newField(sourceFormat, index) {
  return {
    key: `field_${index + 1}`,
    label: `字段 ${index + 1}`,
    field_type: 'text',
    required: false,
    repeating: false,
    confidence: 0,
    locator:
      sourceFormat === 'pdf'
        ? { kind: 'pdf_rect', page: 0, rect: [40, 40, 240, 80] }
        : { kind: 'docx_inferred', anchor: '' },
  };
}

export default function TemplateFieldEditor({ fields, sourceFormat, onChange }) {
  function updateField(index, patch) {
    onChange(fields.map((field, itemIndex) => (itemIndex === index ? { ...field, ...patch } : field)));
  }

  function updateLocator(index, patch) {
    updateField(index, { locator: { ...fields[index].locator, ...patch } });
  }

  function updateRect(index, rectIndex, rawValue) {
    const rect = [...(fields[index].locator?.rect || [0, 0, 100, 30])];
    rect[rectIndex] = Number(rawValue);
    updateLocator(index, { rect });
  }

  return (
    <div className={styles.templateFields}>
      {fields.map((field, index) => (
        <article className={styles.templateFieldCard} key={`${field.key}-${index}`}>
          <div className={styles.fieldCardHeader}>
            <strong>{field.label || field.key || `字段 ${index + 1}`}</strong>
            <span className={field.confidence < 0.7 ? styles.lowConfidence : ''}>
              识别置信度 {Math.round((field.confidence || 0) * 100)}%
            </span>
            <button type="button" onClick={() => onChange(fields.filter((_, item) => item !== index))}>
              删除
            </button>
          </div>
          <div className={styles.fieldGrid}>
            <label>
              字段键
              <input
                value={field.key}
                onChange={(event) => updateField(index, { key: event.target.value })}
                pattern="[A-Za-z][A-Za-z0-9_.-]*"
              />
            </label>
            <label>
              显示名称
              <input
                value={field.label}
                onChange={(event) => updateField(index, { label: event.target.value })}
              />
            </label>
            <label>
              类型
              <select
                value={field.field_type}
                onChange={(event) => updateField(index, { field_type: event.target.value })}
              >
                {FIELD_TYPES.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={Boolean(field.required)}
                onChange={(event) => updateField(index, { required: event.target.checked })}
              />
              必填
            </label>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={Boolean(field.repeating)}
                onChange={(event) => updateField(index, { repeating: event.target.checked })}
              />
              可重复
            </label>
          </div>

          {sourceFormat === 'docx' && field.locator?.kind === 'docx_inferred' && (
            <label className={styles.anchorInput}>
              插入位置前的可见文字
              <input
                value={field.locator.anchor || ''}
                onChange={(event) => updateLocator(index, { anchor: event.target.value })}
                placeholder="例如：单位名称："
              />
            </label>
          )}

          {sourceFormat === 'pdf' && (
            <div className={styles.coordinateGrid}>
              <label>页码（从 1 开始）
                <input
                  type="number"
                  min="1"
                  value={(field.locator?.page || 0) + 1}
                  onChange={(event) => updateLocator(index, { page: Math.max(0, Number(event.target.value) - 1) })}
                />
              </label>
              {['左', '下', '右', '上'].map((label, rectIndex) => (
                <label key={label}>{label}
                  <input
                    type="number"
                    value={field.locator?.rect?.[rectIndex] ?? 0}
                    onChange={(event) => updateRect(index, rectIndex, event.target.value)}
                  />
                </label>
              ))}
            </div>
          )}
        </article>
      ))}

      <button
        type="button"
        className={styles.addFieldButton}
        onClick={() => onChange([...fields, newField(sourceFormat, fields.length)])}
      >
        ＋ 添加字段
      </button>
    </div>
  );
}

