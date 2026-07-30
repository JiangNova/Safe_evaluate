import { useEffect, useState } from 'react';
import { getRules } from '../services/api';
import styles from '../../../frontend/src/pages/evaluate/RuleSelector.module.css';

const CATEGORY_LABELS = {
  fire_exit: '消防通道与疏散',
  equipment: '消防设施与器材',
  electrical: '电气与火源管理',
  management: '消防安全管理',
  building: '建筑与场所属性',
  other: '其他',
};

export default function RuleSelector({ selected, onChange }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRules()
      .then((response) => setRules(response.data.items || []))
      .catch(() => setRules([]))
      .finally(() => setLoading(false));
  }, []);

  function toggleRule(ruleId) {
    onChange(
      selected.includes(ruleId)
        ? selected.filter((id) => id !== ruleId)
        : [...selected, ruleId],
    );
  }

  const grouped = rules.reduce((result, rule) => {
    const category = rule.category || 'other';
    result[category] = [...(result[category] || []), rule];
    return result;
  }, {});

  if (loading) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>📋 评估规则</div>
        <div className={styles.loading}>加载规则中...</div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>📋 评估规则</div>

      {rules.length === 0 ? (
        <div className={styles.empty}>
          暂无可用的公开评估规则，系统仍可依据通用标准进行评估
        </div>
      ) : (
        Object.entries(grouped).map(([category, categoryRules]) => (
          <div key={category} className={styles.group}>
            <div className={styles.groupLabel}>
              {CATEGORY_LABELS[category] || category}
            </div>
            {categoryRules.map((rule) => {
              const checked = selected.includes(rule.id);
              return (
                <button
                  type="button"
                  key={rule.id}
                  className={`${styles.rule} ${checked ? styles.ruleChecked : ''}`}
                  onClick={() => toggleRule(rule.id)}
                >
                  <span
                    className={`${styles.checkbox} ${checked ? styles.checked : ''}`}
                    aria-hidden="true"
                  >
                    {checked ? '✓' : ''}
                  </span>
                  <span className={styles.ruleInfo}>
                    <span className={`${styles.ruleName} ${checked ? styles.checkedText : ''}`}>
                      {rule.name}
                    </span>
                    {rule.description && (
                      <span className={styles.ruleDesc}>{rule.description}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        ))
      )}

      <div className={styles.hint}>
        未选择任何规则时，系统将依据通用安全标准进行评估
      </div>
    </div>
  );
}

