import styles from './CorrectionNotice.module.css';

const VIOLATION_ITEMS = {
  1: '消防设施、器材/消防安全标志的配置、设置不符合标准',
  2: '消防设施、器材/消防安全标志未保持完好有效',
  3: '损坏/挪用消防设施、器材',
  4: '擅自拆除/停用消防设施、器材',
  5: '占用/堵塞/封闭疏散通道、安全出口',
  6: '埋压/圈占/遮挡消火栓，占用防火间距',
  7: '违反消防安全规定进入生产/储存易燃易爆危险品场所',
  8: '违反规定使用明火作业',
  9: '在具有火灾、爆炸危险的场所吸烟/使用明火',
  10: '占用/堵塞/封闭消防车通道，妨碍消防车通行',
  11: '人员密集场所外墙门窗上设置影响逃生、灭火救援的障碍物',
  12: '其他消防安全违法行为和火灾隐患',
};

export default function CorrectionNotice({ data }) {
  if (!data) return null;

  // If no violations, show a clean notice
  if (!data.has_violations || !data.violation_items || data.violation_items.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <h2>📝 责令立即改正通知书</h2>
          <span className={styles.subtitle}>（根据评估结果生成）</span>
        </div>
        <div className={styles.body}>
          <div className={styles.cleanNotice}>
            ✅ 本次检查未发现需立即改正的消防安全违法行为。
          </div>
        </div>
      </div>
    );
  }

  const items = data.violation_items
    .map((n) => VIOLATION_ITEMS[n])
    .filter(Boolean);

  return (
    <div className={styles.container}>
      <div className={styles.sectionHeader}>
        <h2>📝 责令立即改正通知书</h2>
        <span className={styles.subtitle}>（根据评估结果生成）</span>
      </div>
      <div className={styles.body}>
        <div className={styles.noticeMeta}>
          <div className={styles.noticeNumber}>
            {data.notice_number || '派出所即字〔    〕第     号'}
          </div>
        </div>

        <div className={styles.noticeTo}>
          致：<strong>{data.unit_name || '被检查单位'}</strong>
        </div>

        <p className={styles.noticeIntro}>
          {data.inspection_basis || '根据《中华人民共和国消防法》第五十三条的规定'}
          ，经检查发现存在下列消防安全违法行为，现责令立即改正：
        </p>

        {items.length > 0 && (
          <div className={styles.violationList}>
            {items.map((item, idx) => (
              <div key={idx} className={styles.violationItem}>
                <span className={styles.checkbox}>☑</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        )}

        {data.specific_issues && (
          <div className={styles.specificSection}>
            <div className={styles.specificLabel}>具体问题：</div>
            <pre className={styles.specificText}>{data.specific_issues}</pre>
          </div>
        )}

        <div className={styles.noticeFooter}>
          <p>你单位（场所）应当采取措施，确保消防安全。对消防安全违法行为，将依法移送消防救援机构予以处罚。</p>
          {data.inspection_date && (
            <div className={styles.dateLine}>
              <span>{data.inspection_date}</span>
            </div>
          )}
        </div>

        <div className={styles.copyHint}>一式两份，一份交被检查单位（场所），一份存档。</div>
      </div>
    </div>
  );
}
