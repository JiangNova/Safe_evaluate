import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getHistoryList } from '../../services/api';
import styles from './HistoryPage.module.css';

const RISK_MAP = {
  low: { label: '低风险', cls: styles.badgeLow },
  medium: { label: '中风险', cls: styles.badgeMedium },
  high: { label: '高风险', cls: styles.badgeHigh },
};

export default function HistoryPage() {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    async function fetchRecords() {
      setLoading(true);
      setError('');
      try {
        const res = await getHistoryList(page, pageSize);
        if (cancelled) return;
        const items = res.data.items || [];
        // Map backend fields (title/risk_level) to display fields (name/risk)
        setRecords(items.map((item) => ({
          id: item.id,
          name: item.title,
          date: item.date,
          risk: item.risk_level,
        })));
        setTotal(res.data.total || 0);
      } catch (err) {
        if (cancelled) return;
        setError('加载历史记录失败，请检查后端服务是否启动');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchRecords();
    return () => { cancelled = true; };
  }, [page, location.key]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>历史记录</h1>
        {total > 0 && <span className={styles.count}>共 {total} 条</span>}
      </div>

      {loading ? (
        <div className={styles.loading}>加载中...</div>
      ) : error ? (
        <div className={styles.empty}>{error}</div>
      ) : records.length === 0 ? (
        <div className={styles.empty}>暂无评估记录，快去创建第一条吧</div>
      ) : (
        <>
          <div className={styles.table}>
            <div className={styles.tableHeader}>
              <span>评估名称</span>
              <span>评估时间</span>
              <span>风险等级</span>
              <span>操作</span>
            </div>
            {records.map((record) => {
              const risk = RISK_MAP[record.risk] || RISK_MAP.low;
              return (
                <div
                  key={record.id}
                  className={styles.row}
                  onClick={() => navigate(`/report/${record.id}`)}
                >
                  <span>{record.name}</span>
                  <span>{record.date}</span>
                  <span className={`${styles.badge} ${risk.cls}`}>
                    {risk.label}
                  </span>
                  <span
                    className={styles.viewLink}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/report/${record.id}`);
                    }}
                  >
                    查看报告
                  </span>
                </div>
              );
            })}
          </div>

          <div className={styles.pagination}>
            <button
              className={styles.pageBtn}
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                className={`${styles.pageBtn} ${page === p ? styles.pageActive : ''}`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
            <button
              className={styles.pageBtn}
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              ›
            </button>
          </div>
        </>
      )}
    </div>
  );
}
