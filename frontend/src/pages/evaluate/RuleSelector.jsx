import { useState, useEffect } from 'react';
import { getRules } from '../../services/api';
import styles from './RuleSelector.module.css';

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
    async function fetchRules() {
      try {
        const res = await getRules();
        setRules(res.data.items || []);
      } catch {
        // Fallback to empty — rules will be fetched when API is ready
        setRules([]);
      } finally {
        setLoading(false);
      }
    }
    fetchRules();
  }, []);

  function toggleRule(ruleId) {
    if (selected.includes(ruleId)) {
      onChange(selected.filter((id) => id !== ruleId));
    } else {
      onChange([...selected, ruleId]);
    }
  }

  // Group rules by category
  const grouped = {};
  for (const rule of rules) {
    const cat = rule.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(rule);
  }

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
        <div className={styles.empty}>暂无可用规则，请先在"规则管理"中添加</div>
      ) : (
        Object.entries(grouped).map(([cat, catRules]) => (
          <div key={cat} className={styles.group}>
            <div className={styles.groupLabel}>{CATEGORY_LABELS[cat] || cat}</div>
            {catRules.map((rule) => {
              const isChecked = selected.includes(rule.id);
              return (
                <div
                  key={rule.id}
                  className={`${styles.rule} ${isChecked ? styles.ruleChecked : ''}`}
                  onClick={() => toggleRule(rule.id)}
                >
                  <div
                    className={`${styles.checkbox} ${isChecked ? styles.checked : ''}`}
                  >
                    {isChecked ? '✓' : ''}
                  </div>
                  <div className={styles.ruleInfo}>
                    <span className={`${styles.ruleName} ${isChecked ? styles.checkedText : ''}`}>
                      {rule.name}
                    </span>
                    {rule.description && (
                      <span className={styles.ruleDesc}>{rule.description}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}

      <div className={styles.hint}>
        未选择任何规则时，系统将依据全部法规文档进行评估
      </div>
    </div>
  );
}
