import styles from '../App.module.css';

export default function DocumentFieldEditor({
  definitions,
  values,
  initialValues,
  onChange,
  onRegenerate,
  onRestore,
  regeneratingKey,
}) {
  function updateValue(key, value) {
    const current = values[key] || { value: '', source_refs: [], confidence: 0 };
    onChange({ ...values, [key]: { ...current, value } });
  }

  return (
    <div className={styles.documentFields}>
      {definitions.map((field) => {
        const payload = values[field.key] || { value: '', source_refs: [], confidence: 0 };
        const value = payload.value ?? '';
        return (
          <section key={field.key} className={styles.documentField}>
            <div className={styles.documentFieldHeader}>
              <label htmlFor={`field-${field.key}`}>{field.label}</label>
              <span>AI 置信度 {Math.round((payload.confidence || 0) * 100)}%</span>
            </div>
            {field.field_type === 'boolean' ? (
              <select
                id={`field-${field.key}`}
                value={String(value)}
                onChange={(event) => updateValue(field.key, event.target.value === 'true')}
              >
                <option value="">未填写</option>
                <option value="true">是</option>
                <option value="false">否</option>
              </select>
            ) : field.field_type === 'multiline' || field.field_type === 'list' ? (
              <textarea
                id={`field-${field.key}`}
                value={Array.isArray(value) ? value.join('\n') : value}
                onChange={(event) =>
                  updateValue(
                    field.key,
                    field.field_type === 'list' ? event.target.value.split('\n').filter(Boolean) : event.target.value,
                  )
                }
              />
            ) : (
              <input
                id={`field-${field.key}`}
                type={field.field_type === 'date' ? 'date' : 'text'}
                value={value}
                onChange={(event) => updateValue(field.key, event.target.value)}
              />
            )}
            {payload.source_refs?.length > 0 && (
              <p className={styles.sourceRefs}>来源：{payload.source_refs.join('、')}</p>
            )}
            <div className={styles.fieldActions}>
              <button type="button" onClick={() => onRegenerate(field.key)} disabled={regeneratingKey === field.key}>
                {regeneratingKey === field.key ? '正在重新生成…' : '重新生成此字段'}
              </button>
              <button
                type="button"
                onClick={() => onRestore(field.key, initialValues[field.key])}
                disabled={!initialValues[field.key]}
              >
                恢复 AI 初稿
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

