export default function ProfileLibrary({ profiles, activeProfileId, onSelect, onCreate, onDelete }) {
  return (
    <section className="panel profile-library" aria-label="身份档案列表">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">本地工作区</p>
          <h2>我的身份档案</h2>
        </div>
        <button className="icon-button" type="button" onClick={onCreate} aria-label="新建身份档案">＋</button>
      </div>

      <p className="panel-intro">为不同岗位建立专属工作语境，生成时会结合所选身份。</p>
      <div className="profile-list">
        {profiles.length === 0 ? (
          <div className="empty-compact">还没有身份档案。请先新建一份。</div>
        ) : profiles.map((profile) => (
          <div className={`profile-item ${profile.id === activeProfileId ? 'is-active' : ''}`} key={profile.id}>
            <button type="button" className="profile-select" onClick={() => onSelect(profile.id)}>
              <strong>{profile.name || '未命名身份'}</strong>
              <span>{[profile.title, profile.organization].filter(Boolean).join(' · ') || '待补充岗位信息'}</span>
            </button>
            <button
              type="button"
              className="delete-button"
              onClick={() => onDelete(profile.id)}
              aria-label={`删除${profile.name || '身份档案'}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="local-note">本地保存 · 无需账号</div>
    </section>
  );
}
