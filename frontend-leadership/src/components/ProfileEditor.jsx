const FIELDS = [
  ['name', '档案名称', '例如：化学学院党委书记', true, 'input'],
  ['title', '岗位', '例如：党委书记', false, 'input'],
  ['organization', '学院 / 部门', '例如：化学学院', false, 'input'],
  ['responsibilities', '职责范围', '说明负责的工作、对象与边界', false, 'textarea'],
  ['focusAreas', '工作重点', '例如：实验室危化品安全、党建落实', false, 'textarea'],
  ['writingPreferences', '行文偏好', '例如：正式、务实、条理清楚', false, 'textarea'],
  ['notes', '补充说明', '可补充常用称谓、需要回避的表述等', false, 'textarea'],
];

export default function ProfileEditor({ profile, isNew, onChange, onSave, onCancel }) {
  return (
    <section className="panel profile-editor" aria-label="身份档案编辑">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">身份设定</p>
          <h2>{isNew ? '新建身份档案' : '编辑身份档案'}</h2>
        </div>
      </div>
      <div className="profile-fields">
        {FIELDS.map(([key, label, placeholder, required, tag]) => (
          <label key={key} className={tag === 'textarea' ? 'field field-wide' : 'field'}>
            <span>{label}{required ? <em> *</em> : ''}</span>
            {tag === 'textarea' ? (
              <textarea value={profile[key] || ''} placeholder={placeholder} rows="3" onChange={(event) => onChange(key, event.target.value)} />
            ) : (
              <input value={profile[key] || ''} placeholder={placeholder} onChange={(event) => onChange(key, event.target.value)} />
            )}
          </label>
        ))}
      </div>
      <div className="actions profile-actions">
        {!isNew && <button type="button" className="secondary-button" onClick={onCancel}>取消修改</button>}
        <button type="button" className="primary-button" onClick={onSave}>保存身份</button>
      </div>
    </section>
  );
}
