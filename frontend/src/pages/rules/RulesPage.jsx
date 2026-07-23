import { useState, useEffect, useCallback } from 'react';
import { getRules, createRule, updateRule, deleteRule } from '../../services/api';
import Button from '../../components/ui/Button';
import Loading from '../../components/ui/Loading';
import styles from './RulesPage.module.css';

const CATEGORY_LABELS = {
  fire_exit: '消防通道与疏散',
  equipment: '消防设施与器材',
  electrical: '电气与火源管理',
  management: '消防安全管理',
  building: '建筑与场所属性',
  other: '其他',
};

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS);

export default function RulesPage() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: 'other',
    description: '',
    source_doc: '',
    clause: '',
  });

  const fetchRules = useCallback(async () => {
    try {
      const res = await getRules(filterCategory);
      setRules(res.data.items || []);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || '未知错误';
      setError(`加载规则列表失败: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [filterCategory]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  function openCreateForm() {
    setEditingRule(null);
    setForm({ name: '', category: 'other', description: '', source_doc: '', clause: '' });
    setShowForm(true);
  }

  function openEditForm(rule) {
    setEditingRule(rule);
    setForm({
      name: rule.name || '',
      category: rule.category || 'other',
      description: rule.description || '',
      source_doc: rule.source_doc || '',
      clause: rule.clause || '',
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingRule(null);
    setError('');
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError('请输入规则名称');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editingRule) {
        await updateRule(editingRule.id, form);
      } else {
        await createRule(form);
      }
      closeForm();
      fetchRules();
    } catch (err) {
      setError(err.response?.data?.detail || '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(rule) {
    if (!window.confirm(`确定要删除规则「${rule.name}」吗？`)) return;
    try {
      await deleteRule(rule.id);
      fetchRules();
    } catch (err) {
      setError(err.response?.data?.detail || '删除失败');
    }
  }

  function handleFormChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  if (loading) return <Loading text="加载规则中..." />;

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>规则管理</h1>
          <p className={styles.subtitle}>
            管理评估依据的消防法规标准，支持自定义添加检查规则
          </p>
        </div>
        <Button onClick={openCreateForm}>+ 新增规则</Button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {/* Category filter */}
      <div className={styles.toolbar}>
        <select
          className={styles.filterSelect}
          value={filterCategory}
          onChange={(e) => { setFilterCategory(e.target.value); setLoading(true); }}
        >
          <option value="">全部类别</option>
          {CATEGORY_OPTIONS.map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <span className={styles.count}>共 {rules.length} 条规则</span>
      </div>

      {/* Rule form modal */}
      {showForm && (
        <div className={styles.overlay} onClick={closeForm}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>
              {editingRule ? '编辑规则' : '新增规则'}
            </h2>

            <div className={styles.formGroup}>
              <label className={styles.label}>规则名称 *</label>
              <input
                className={styles.input}
                value={form.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                placeholder="例如：GB 50016 建筑设计防火规范"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>类别</label>
              <select
                className={styles.select}
                value={form.category}
                onChange={(e) => handleFormChange('category', e.target.value)}
              >
                {CATEGORY_OPTIONS.map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>描述</label>
              <textarea
                className={styles.textarea}
                value={form.description}
                onChange={(e) => handleFormChange('description', e.target.value)}
                placeholder="简要说明该规则涵盖的检查内容和适用范围"
                rows={3}
              />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.label}>来源文档</label>
                <input
                  className={styles.input}
                  value={form.source_doc}
                  onChange={(e) => handleFormChange('source_doc', e.target.value)}
                  placeholder="对应 requirement/ 下的文档名"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>条款编号</label>
                <input
                  className={styles.input}
                  value={form.clause}
                  onChange={(e) => handleFormChange('clause', e.target.value)}
                  placeholder="如：第5.5.18条"
                />
              </div>
            </div>

            {error && <div className={styles.formError}>{error}</div>}

            <div className={styles.modalActions}>
              <Button variant="secondary" onClick={closeForm}>取消</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rules table */}
      {rules.length === 0 ? (
        <div className={styles.empty}>暂无规则数据</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>规则名称</th>
                <th>类别</th>
                <th>来源文档</th>
                <th>类型</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td>
                    <div className={styles.ruleName}>{rule.name}</div>
                    {rule.description && (
                      <div className={styles.ruleDesc}>{rule.description}</div>
                    )}
                  </td>
                  <td>
                    <span className={`${styles.categoryBadge} ${styles[`cat_${rule.category}`] || ''}`}>
                      {CATEGORY_LABELS[rule.category] || rule.category}
                    </span>
                  </td>
                  <td className={styles.sourceDoc}>
                    {rule.source_doc || '—'}
                    {rule.clause && <span className={styles.clause}> {rule.clause}</span>}
                  </td>
                  <td>
                    <span className={rule.is_custom ? styles.customBadge : styles.builtinBadge}>
                      {rule.is_custom ? '自定义' : '内置'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.actionBtn} onClick={() => openEditForm(rule)}>
                        编辑
                      </button>
                      {rule.is_custom && (
                        <button
                          className={`${styles.actionBtn} ${styles.deleteBtn}`}
                          onClick={() => handleDelete(rule)}
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
