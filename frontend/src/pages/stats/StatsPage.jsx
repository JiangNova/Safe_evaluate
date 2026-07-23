import { useState, useEffect } from 'react';
import { getStats } from '../../services/api';
import Loading from '../../components/ui/Loading';
import styles from './StatsPage.module.css';

const CATEGORY_LABELS = {
  fire_exit: '消防通道与疏散',
  equipment: '消防设施与器材',
  electrical: '电气与火源管理',
  management: '消防安全管理',
  building: '建筑与场所属性',
  other: '其他',
};

const CATEGORY_COLORS = {
  fire_exit: '#dc2626',
  equipment: '#2563eb',
  electrical: '#d97706',
  management: '#7c3aed',
  building: '#059669',
  other: '#6b7280',
};

export default function StatsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await getStats();
        setData(res.data);
      } catch (err) {
        const msg = err.response?.data?.detail || err.message || '未知错误';
        setError(`加载统计数据失败: ${msg}`);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) return <Loading text="加载统计数据..." />;
  if (error) return <div className={styles.error}>{error}</div>;
  if (!data) return null;

  const { overview, by_category, top_issues, trends } = data;

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>统计分析</h1>
        <p className={styles.subtitle}>消防安全评估数据总览与趋势分析</p>
      </div>

      {/* Overview cards */}
      <div className={styles.overviewGrid}>
        <div className={`${styles.overviewCard} ${styles.cardTotal}`}>
          <div className={styles.overviewIcon}>📊</div>
          <div className={styles.overviewValue}>{overview.total_reports}</div>
          <div className={styles.overviewLabel}>评估总次数</div>
        </div>
        <div className={`${styles.overviewCard} ${styles.cardRate}`}>
          <div className={styles.overviewIcon}>📈</div>
          <div className={styles.overviewValue}>{overview.compliance_rate}%</div>
          <div className={styles.overviewLabel}>整体合规率</div>
        </div>
        <div className={`${styles.overviewCard} ${styles.cardDanger}`}>
          <div className={styles.overviewIcon}>⚠️</div>
          <div className={styles.overviewValue}>{overview.total_non_compliant}</div>
          <div className={styles.overviewLabel}>不合规项总数</div>
        </div>
        <div className={`${styles.overviewCard} ${styles.cardSuggest}`}>
          <div className={styles.overviewIcon}>💡</div>
          <div className={styles.overviewValue}>{overview.total_suggestions}</div>
          <div className={styles.overviewLabel}>整改建议总数</div>
        </div>
      </div>

      {/* Risk distribution */}
      <div className={styles.riskRow}>
        <div className={styles.riskCard}>
          <div className={styles.riskTitle}>风险等级分布</div>
          <div className={styles.riskBars}>
            <div className={styles.riskItem}>
              <span className={styles.riskLabel}>🟢 低风险</span>
              <div className={styles.riskBarTrack}>
                <div
                  className={`${styles.riskBar} ${styles.riskLow}`}
                  style={{ width: overview.total_reports > 0 ? `${(overview.risk_distribution.low / overview.total_reports * 100).toFixed(0)}%` : '0%' }}
                />
              </div>
              <span className={styles.riskCount}>{overview.risk_distribution.low}</span>
            </div>
            <div className={styles.riskItem}>
              <span className={styles.riskLabel}>🟡 中风险</span>
              <div className={styles.riskBarTrack}>
                <div
                  className={`${styles.riskBar} ${styles.riskMedium}`}
                  style={{ width: overview.total_reports > 0 ? `${(overview.risk_distribution.medium / overview.total_reports * 100).toFixed(0)}%` : '0%' }}
                />
              </div>
              <span className={styles.riskCount}>{overview.risk_distribution.medium}</span>
            </div>
            <div className={styles.riskItem}>
              <span className={styles.riskLabel}>🔴 高风险</span>
              <div className={styles.riskBarTrack}>
                <div
                  className={`${styles.riskBar} ${styles.riskHigh}`}
                  style={{ width: overview.total_reports > 0 ? `${(overview.risk_distribution.high / overview.total_reports * 100).toFixed(0)}%` : '0%' }}
                />
              </div>
              <span className={styles.riskCount}>{overview.risk_distribution.high}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two-column section */}
      <div className={styles.twoCol}>
        {/* By category */}
        <div className={styles.panel}>
          <div className={styles.panelTitle}>📋 不合规项分类分布</div>
          {by_category.length === 0 ? (
            <div className={styles.panelEmpty}>暂无数据</div>
          ) : (
            <div className={styles.catList}>
              {by_category.map((cat) => (
                <div key={cat.category} className={styles.catItem}>
                  <div className={styles.catHeader}>
                    <span
                      className={styles.catDot}
                      style={{ background: CATEGORY_COLORS[cat.category] || '#6b7280' }}
                    />
                    <span className={styles.catLabel}>{cat.label}</span>
                    <span className={styles.catCount}>{cat.non_compliant_count} 项</span>
                    <span className={styles.catPct}>{cat.percentage}%</span>
                  </div>
                  <div className={styles.catBarTrack}>
                    <div
                      className={styles.catBar}
                      style={{
                        width: `${cat.percentage}%`,
                        background: CATEGORY_COLORS[cat.category] || '#6b7280',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top issues */}
        <div className={styles.panel}>
          <div className={styles.panelTitle}>🔴 高频问题 TOP{top_issues.length}</div>
          {top_issues.length === 0 ? (
            <div className={styles.panelEmpty}>暂无数据</div>
          ) : (
            <div className={styles.issueList}>
              {top_issues.map((issue, idx) => (
                <div key={idx} className={styles.issueItem}>
                  <span className={styles.issueRank}>{idx + 1}</span>
                  <div className={styles.issueContent}>
                    <span className={styles.issueTitle}>{issue.title}</span>
                    <span className={styles.issueCat}>
                      {CATEGORY_LABELS[issue.category] || issue.category}
                    </span>
                  </div>
                  <span className={styles.issueCount}>{issue.count} 次</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Trends */}
      <div className={styles.panel}>
        <div className={styles.panelTitle}>📈 月度合规率趋势</div>
        {trends.length === 0 ? (
          <div className={styles.panelEmpty}>暂无趋势数据</div>
        ) : (
          <div className={styles.trendChart}>
            <div className={styles.trendBars}>
              {trends.map((point) => (
                <div key={point.period} className={styles.trendCol}>
                  <div className={styles.trendBarWrap}>
                    <div
                      className={styles.trendBar}
                      style={{ height: `${point.compliance_rate}%` }}
                      title={`${point.compliance_rate}%`}
                    />
                  </div>
                  <div className={styles.trendRate}>{point.compliance_rate}%</div>
                  <div className={styles.trendPeriod}>{point.period}</div>
                  <div className={styles.trendCount}>{point.total} 次</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
