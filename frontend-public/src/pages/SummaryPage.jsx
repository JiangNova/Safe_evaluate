import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../../../frontend/src/components/ui/Button';
import Loading from '../../../frontend/src/components/ui/Loading';
import { getReport } from '../services/api';
import styles from '../../../frontend/src/pages/evaluate/EvaluateSummary.module.css';

const RISK_LABELS = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
  failed: '评估失败',
};

const RISK_COLORS = {
  low: '#059669',
  medium: '#d97706',
  high: '#dc2626',
  failed: '#6b7280',
};

export default function SummaryPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ids = useMemo(
    () => searchParams.get('ids')?.split(',').filter(Boolean) || [],
    [searchParams],
  );
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    if (ids.length === 0) {
      navigate('/', { replace: true });
      return;
    }

    Promise.allSettled(
      ids.map((id) =>
        getReport(id)
          .then((response) => ({ id, data: response.data, error: null }))
          .catch((error) => ({
            id,
            data: null,
            error:
              error.response?.data?.detail ||
              error.message ||
              '报告加载失败',
          })),
      ),
    ).then((results) => {
      setReports(
        results.map((result, index) =>
          result.status === 'fulfilled'
            ? result.value
            : { id: ids[index], data: null, error: '报告加载失败' },
        ),
      );
      setLoading(false);
    });
  }, [ids, navigate]);

  if (loading) return <Loading text="正在加载评估报告..." />;

  const successCount = reports.filter(
    (report) => report.data && report.data.status !== 'failed',
  ).length;
  const failedCount = reports.length - successCount;

  return (
    <div>
      <button className={styles.backBtn} onClick={() => navigate('/')}>
        ← 返回继续评估
      </button>

      <div className={styles.header}>
        <h1 className={styles.title}>分图评估结果</h1>
        <p className={styles.subtitle}>
          {reports.length} 份报告 · {successCount} 份完成
          {failedCount > 0 ? ` · ${failedCount} 份失败` : ''}
        </p>
      </div>

      <div className={styles.cardList}>
        {reports.map((report, index) => {
          const failed = Boolean(report.error) || report.data?.status === 'failed';
          const risk = report.data?.risk_level || (failed ? 'failed' : 'low');
          const stats = report.data?.stats || {};
          const image = report.data?.images?.[0];

          return (
            <article
              key={report.id}
              className={`${styles.card} ${failed ? styles.cardFailed : ''}`}
            >
              <div className={styles.cardBody}>
                <button
                  type="button"
                  className={styles.cardThumb}
                  onClick={() =>
                    image?.url &&
                    setPreviewImage({
                      url: image.url,
                      filename: image.filename || report.data?.filename,
                    })
                  }
                  aria-label={image?.url ? '查看原图' : '没有可预览图片'}
                >
                  {image?.url ? (
                    <img
                      src={image.url}
                      alt={report.data?.filename || `报告 ${index + 1}`}
                      className={styles.thumbImg}
                    />
                  ) : (
                    <span className={styles.thumbPlaceholder}>📷</span>
                  )}
                </button>

                <div className={styles.cardContent}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardStatus}>{failed ? '❌' : '✅'}</span>
                    <span className={styles.cardFilename}>
                      {report.data?.filename || `报告 ${index + 1}`}
                    </span>
                    <span
                      className={styles.cardRisk}
                      style={{ color: RISK_COLORS[risk] || RISK_COLORS.failed }}
                    >
                      {RISK_LABELS[risk] || RISK_LABELS.failed}
                    </span>
                  </div>

                  {failed ? (
                    <div className={styles.cardError}>
                      {report.error ||
                        report.data?.error_message ||
                        '本项评估未成功完成'}
                    </div>
                  ) : (
                    <>
                      <div className={styles.cardTitle}>
                        {report.data?.title || '安全风险评估报告'}
                      </div>
                      <div className={styles.cardStats}>
                        <span className={styles.stat}>✅ {stats.compliant || 0}</span>
                        <span className={styles.stat}>⚠️ {stats.nonCompliant || 0}</span>
                        <span className={styles.stat}>💡 {stats.suggestions || 0}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className={styles.cardActions}>
                {failed ? (
                  <Button variant="secondary" size="sm" onClick={() => navigate('/')}>
                    返回重新评估
                  </Button>
                ) : (
                  <Link to={`/report/${report.id}`} className={styles.viewBtn}>
                    查看报告 →
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {previewImage && (
        <div
          className={styles.previewOverlay}
          onClick={() => setPreviewImage(null)}
          role="presentation"
        >
          <div className={styles.previewBox} onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className={styles.previewClose}
              onClick={() => setPreviewImage(null)}
              aria-label="关闭预览"
            >
              ✕
            </button>
            <img
              src={previewImage.url}
              alt={previewImage.filename}
              className={styles.previewImg}
            />
            <div className={styles.previewName}>{previewImage.filename}</div>
          </div>
        </div>
      )}
    </div>
  );
}

