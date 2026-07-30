import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getReport } from '../../services/api';
import StatCard from './StatCard';
import FindingItem from './FindingItem';
import InspectionRecord from './InspectionRecord';
import CorrectionNotice from './CorrectionNotice';
import Button from '../../components/ui/Button';
import styles from './ReportPage.module.css';

export default function ReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchReport() {
      try {
        const res = await getReport(id);
        setReport(res.data);
      } catch (err) {
        const detail = err.response?.data?.detail || '';
        setError(
          detail
            ? `加载报告失败: ${detail}`
            : '加载报告失败，请确认报告ID有效且后端服务正常运行'
        );
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [id]);

  if (loading) {
    return <div className={styles.loading}>加载报告中...</div>;
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>!</div>
        <h2>无法加载报告</h2>
        <p>{error}</p>
        <Button variant="secondary" onClick={() => navigate('/history')}>
          返回历史记录
        </Button>
      </div>
    );
  }

  if (!report) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>!</div>
        <h2>报告不存在</h2>
        <p>未找到该报告，可能已被删除</p>
        <Button variant="secondary" onClick={() => navigate('/history')}>
          返回历史记录
        </Button>
      </div>
    );
  }

  // Failed evaluation — show error details instead of blank/mock report
  if (report.status === 'failed') {
    return (
      <div className={styles.failedPage}>
        <div className={styles.header}>
          <h1 className={styles.title}>消防安全评估报告</h1>
          <span className={styles.dateBadge}>{report.date}</span>
        </div>

        {report.images && report.images.length > 0 && (
          <div className={styles.imageSection}>
            {report.images.map((img) => (
              <div key={img.index} className={styles.imageWrap}>
                <img
                  src={img.url}
                  alt={img.filename || '评估图片'}
                  className={styles.reportImage}
                />
                <span className={styles.imageLabel}>{img.filename}</span>
              </div>
            ))}
          </div>
        )}

        <div className={styles.failedBanner}>
          <h3>⚠️ 评估执行失败</h3>
          <p className={styles.failedMessage}>
            {report.error_message || '未知错误'}
          </p>
          {report.raw_response && (
            <details className={styles.rawResponse}>
              <summary>查看原始AI响应（调试用）</summary>
              <pre>{report.raw_response.substring(0, 2000)}</pre>
            </details>
          )}
          <p className={styles.retryHint}>
            请返回评估页面重新上传文件进行评估
          </p>
          <div className={styles.failedActions}>
            <Button variant="secondary" onClick={() => navigate('/history')}>
              返回历史
            </Button>
            <Button onClick={() => navigate('/evaluate')}>
              重新评估
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const data = report;

  // Split findings into pass/fail for clear display
  const passItems = data.findings.filter(f => f.severity === 'success');
  const failItems = data.findings.filter(f => f.severity === 'danger' || f.severity === 'warning');

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>{data.title}</h1>
        <span className={styles.dateBadge}>{data.date}</span>
      </div>

      {data.images && data.images.length > 0 && (
        <div className={styles.imageSection}>
          {data.images.map((img) => (
            <div key={img.index} className={styles.imageWrap}>
              <img
                src={img.url}
                alt={img.filename || '评估图片'}
                className={styles.reportImage}
              />
              <span className={styles.imageLabel}>{img.filename}</span>
            </div>
          ))}
        </div>
      )}

      {data.overall_assessment && (
        <div className={styles.overallBox}>
          <div className={styles.overallLabel}>📋 总体评估</div>
          <p className={styles.overallText}>{data.overall_assessment}</p>
        </div>
      )}

      <div className={styles.stats}>
        <StatCard
          type="success"
          label="过关项"
          value={data.stats.compliant}
          desc="符合消防规范"
        />
        <StatCard
          type="danger"
          label="不过关项"
          value={data.stats.nonCompliant}
          desc="存在消防隐患"
        />
        <StatCard
          type="warning"
          label="整改建议"
          value={data.stats.suggestions}
          desc="建议限期整改"
        />
      </div>

      <div className={styles.detailCard}>
        {failItems.length > 0 && (
          <>
            <div className={styles.sectionTitle}>🔴 不过关项 — 需要整改</div>
            {failItems.map((f, i) => (
              <FindingItem
                key={`fail-${i}`}
                severity={f.severity}
                category={f.category}
                title={f.title}
                detail={f.detail}
                regulation_ref={f.regulation_ref}
              />
            ))}
          </>
        )}

        {passItems.length > 0 && (
          <>
            <div className={styles.sectionTitle}>🟢 过关项 — 符合规范</div>
            {passItems.map((f, i) => (
              <FindingItem
                key={`pass-${i}`}
                severity={f.severity}
                category={f.category}
                title={f.title}
                detail={f.detail}
                regulation_ref={f.regulation_ref}
              />
            ))}
          </>
        )}

        {data.findings.length === 0 && (
          <div className={styles.empty}>暂无详细评估数据</div>
        )}
      </div>

      {/* Template-based official documents */}
      <InspectionRecord data={data.inspection_record} />
      <CorrectionNotice data={data.correction_notice} />

      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => window.print()}>
          打印报告
        </Button>
        <Button onClick={() => window.print()}>导出 PDF</Button>
      </div>
    </div>
  );
}
