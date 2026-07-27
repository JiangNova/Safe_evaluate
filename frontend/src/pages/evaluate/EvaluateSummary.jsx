import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { getReport } from '../../services/api';
import Button from '../../components/ui/Button';
import Loading from '../../components/ui/Loading';
import styles from './EvaluateSummary.module.css';

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

export default function EvaluateSummary() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ids = searchParams.get('ids')?.split(',').filter(Boolean) || [];

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState(null); // { url, filename } | null

  useEffect(() => {
    if (ids.length === 0) {
      navigate('/evaluate', { replace: true });
      return;
    }

    const initial = ids.map((id) => ({ id, data: null, loading: true, error: null }));
    setReports(initial);

    Promise.allSettled(
      ids.map((id) =>
        getReport(id)
          .then((res) => ({ id, data: res.data, loading: false, error: null }))
          .catch((err) => ({
            id,
            data: null,
            loading: false,
            error: err.response?.data?.detail || err.message || '加载失败',
          }))
      )
    ).then((results) => {
      setReports(
        results.map((r) =>
          r.status === 'fulfilled' ? r.value : { id: '', data: null, loading: false, error: '加载失败' }
        )
      );
      setLoading(false);
    });
  }, [searchParams, navigate]);

  const successCount = reports.filter((r) => r.data && r.data.status !== 'failed').length;
  const failCount = reports.filter((r) => r.error || r.data?.status === 'failed').length;

  if (loading && reports.length === 0) return <Loading text="加载报告中..." />;

  return (
    <div>
      <button className={styles.backBtn} onClick={() => navigate('/evaluate')}>
        ← 返回评估
      </button>

      <div className={styles.header}>
        <h1 className={styles.title}>分图评估结果</h1>
        <p className={styles.subtitle}>
          {new Date().toLocaleDateString('zh-CN')} · {ids.length} 张图片
          {!loading && ` · ${successCount} 份完成，${failCount} 份失败`}
        </p>
      </div>

      <div className={styles.cardList}>
        {reports.map((r, i) => {
          const isFailed = !!r.error || r.data?.status === 'failed';
          const risk = r.data?.risk_level || (isFailed ? 'failed' : 'low');
          const stats = r.data?.stats || {};

          return (
            <div
              key={r.id || i}
              className={`${styles.card} ${isFailed ? styles.cardFailed : ''}`}
            >
              <div className={styles.cardBody}>
                <div
                  className={styles.cardThumb}
                  onClick={() => {
                    const img = r.data?.images?.[0];
                    if (img?.url) setPreviewImage({ url: img.url, filename: img.filename || r.data?.filename });
                  }}
                  title="点击查看原图"
                >
                  {r.data?.images?.[0]?.url ? (
                    <img
                      src={r.data.images[0].url}
                      alt={r.data?.filename || `报告 #${i + 1}`}
                      className={styles.thumbImg}
                    />
                  ) : (
                    <div className={styles.thumbPlaceholder}>📷</div>
                  )}
                </div>
                <div className={styles.cardContent}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardStatus}>{isFailed ? '❌' : '✅'}</span>
                    <span className={styles.cardFilename}>
                      {r.data?.filename || `报告 #${i + 1}`}
                    </span>
                    <span
                      className={styles.cardRisk}
                      style={{ color: RISK_COLORS[risk] || RISK_COLORS.failed }}
                    >
                      {RISK_LABELS[risk] || RISK_LABELS.failed}
                    </span>
                  </div>

                  {isFailed ? (
                    <div className={styles.cardError}>
                      {r.error || r.data?.error_message || '评估执行失败，AI 服务暂时不可用'}
                    </div>
                  ) : (
                    <>
                      <div className={styles.cardTitle}>
                        {r.data?.title || '消防安全评估报告'}
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
                {isFailed ? (
                  <Button variant="secondary" size="sm" onClick={() => navigate('/evaluate')}>
                    🔄 返回重新评估
                  </Button>
                ) : (
                  <Link to={`/report/${r.id}`} className={styles.viewBtn}>
                    查看报告 →
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Image preview modal */}
      {previewImage && (
        <div className={styles.previewOverlay} onClick={() => setPreviewImage(null)}>
          <div className={styles.previewBox} onClick={(e) => e.stopPropagation()}>
            <button className={styles.previewClose} onClick={() => setPreviewImage(null)}>✕</button>
            <img src={previewImage.url} alt={previewImage.filename} className={styles.previewImg} />
            <div className={styles.previewName}>{previewImage.filename}</div>
          </div>
        </div>
      )}
    </div>
  );
}
