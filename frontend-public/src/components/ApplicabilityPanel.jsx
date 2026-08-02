import styles from '../App.module.css';

export default function ApplicabilityPanel({ applicability }) {
  if (!applicability) return null;
  const blocked = ['insufficient_evidence', 'not_applicable', 'failed'].includes(applicability.status);
  return (
    <section className={`${styles.statusPanel} ${blocked ? styles.blockingPanel : ''}`}>
      <strong>文书适用性</strong>
      <span>{blocked ? '暂不能生成' : applicability.status === 'needs_input' ? '待人工补充' : '适用条件已满足'}</span>
      {applicability.reason && <p>{applicability.reason}</p>}
      {applicability.missing_requirements?.length > 0 && <small>缺少：{applicability.missing_requirements.join('、')}</small>}
    </section>
  );
}
