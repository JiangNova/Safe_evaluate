import { useState } from 'react';
import styles from './RuleSelector.module.css';

const DEFAULT_RULES = [
  { id: 'gb50016', label: 'GB 50016 建筑设计防火规范' },
  { id: 'gb50116', label: 'GB 50116 火灾自动报警系统设计规范' },
  { id: 'gb50974', label: 'GB 50974 消防给水及消火栓系统规范' },
  { id: 'ga653', label: 'GA 653 人员密集场所消防安全管理' },
];

export default function RuleSelector({ selected, onChange }) {
  const [rules] = useState(DEFAULT_RULES);

  function toggleRule(ruleId) {
    if (selected.includes(ruleId)) {
      onChange(selected.filter((id) => id !== ruleId));
    } else {
      onChange([...selected, ruleId]);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>📋 评估规则</div>
      {rules.map((rule) => {
        const isChecked = selected.includes(rule.id);
        return (
          <div
            key={rule.id}
            className={styles.rule}
            onClick={() => toggleRule(rule.id)}
          >
            <div
              className={`${styles.checkbox} ${isChecked ? styles.checked : ''}`}
            >
              {isChecked ? '✓' : ''}
            </div>
            <span
              className={`${styles.ruleName} ${isChecked ? styles.checkedText : ''}`}
            >
              {rule.label}
            </span>
          </div>
        );
      })}
      <div className={styles.addMore}>+ 自定义添加规则</div>
    </div>
  );
}
