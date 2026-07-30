import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../../../frontend/src/components/ui/Button';
import FindingItem from '../../../frontend/src/pages/report/FindingItem';
import StatCard from '../../../frontend/src/pages/report/StatCard';
import { getReport } from '../services/api';
import styles from '../../../frontend/src/pages/report/ReportPage.module.css';

export default function ReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getReport(id)
      .then((response) => setReport(response.data))
      .catch((requestError) =>
        setError(
          requestError.response?.data?.detail ||
            '无法加载报告，请确认链接有效并稍后重试',
        ),
      )
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className={styles.loading}>加载报告中...</div>;
  }

  if (error || !report) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>!</div>
        <h2>无法加载报告</h2>
        <p>{error || '报告不存在或已失效'}</p>
        <Button variant="secondary" onClick={() => navigate('/')}>
          返回继续评估
        </Button>
      </div>
    );
  }

  if (report.status === 'failed') {
    return (
      <div className={styles.failedPage}>
        <div className={styles.header}>
          <h1 className={styles.title}>安全风险评估报告</h1>
          <span className={styles.dateBadge}>{report.date}</span>
        </div>

        <ReportImages images={report.images} />

        <div className={styles.failedBanner}>
          <h3>⚠️ 本次评估未成功完成</h3>
          <p className={styles.failedMessage}>
            {report.error_message || '评估服务暂时不可用'}
          </p>
          <p className={styles.retryHint}>请返回评估页面重新提交材料。</p>
          <div className={styles.failedActions}>
            <Button variant="secondary" onClick={() => navigate('/')}>
              返回继续评估
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const findings = report.findings || [];
  const passItems = findings.filter((item) => item.severity === 'success');
  const issueItems = findings.filter(
    (item) => item.severity === 'danger' || item.severity === 'warning',
  );
  const stats = report.stats || {
    compliant: 0,
    nonCompliant: 0,
    suggestions: 0,
  };

  return (
    <div>
      <button
        type="button"
        className={styles.backButton}
        onClick={() => navigate('/')}
      >
        ← 返回继续评估
      </button>

      <div className={styles.header}>
        <h1 className={styles.title}>{report.title || '安全风险评估报告'}</h1>
        <span className={styles.dateBadge}>{report.date}</span>
      </div>

      <ReportImages images={report.images} />

      {report.overall_assessment && (
        <div className={styles.overallBox}>
          <div className={styles.overallLabel}>📋 总体评估</div>
          <p className={styles.overallText}>{report.overall_assessment}</p>
        </div>
      )}

      <div className={styles.stats}>
        <StatCard
          type="success"
          label="符合项"
          value={stats.compliant}
          desc="符合所选安全标准"
        />
        <StatCard
          type="danger"
          label="风险项"
          value={stats.nonCompliant}
          desc="需要进一步检查"
        />
        <StatCard
          type="warning"
          label="整改建议"
          value={stats.suggestions}
          desc="建议及时处理"
        />
      </div>

      <div className={styles.detailCard}>
        {issueItems.length > 0 && (
          <>
            <div className={styles.sectionTitle}>🔴 风险项与整改建议</div>
            {issueItems.map((finding, index) => (
              <FindingItem key={`issue-${index}`} {...finding} />
            ))}
          </>
        )}

        {passItems.length > 0 && (
          <>
            <div className={styles.sectionTitle}>🟢 符合项</div>
            {passItems.map((finding, index) => (
              <FindingItem key={`pass-${index}`} {...finding} />
            ))}
          </>
        )}

        {findings.length === 0 && (
          <div className={styles.empty}>暂无详细评估数据</div>
        )}
      </div>

      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => navigate('/')}>
          返回继续评估
        </Button>
        <Button onClick={() => window.print()}>打印或导出 PDF</Button>
      </div>
    </div>
  );
}

function ReportImages({ images = [] }) {
  if (images.length === 0) return null;

  return (
    <div className={styles.imageSection}>
      {images.map((image) => (
        <div key={image.index} className={styles.imageWrap}>
          <img
            src={image.url}
            alt={image.filename || '评估材料'}
            className={styles.reportImage}
          />
          <span className={styles.imageLabel}>{image.filename}</span>
        </div>
      ))}
    </div>
  );
}

