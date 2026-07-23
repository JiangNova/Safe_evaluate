import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHistoryList } from '../../services/api';
import styles from './HistoryPage.module.css';

const RISK_MAP = {
  low: { label: '低风险', cls: styles.badgeLow },
  medium: { label: '中风险', cls: styles.badgeMedium },
  high: { label: '高风险', cls: styles.badgeHigh },
};

// Mock data for development
const MOCK_DATA = [
  { id: '1', name: '万达广场消防安全评估', date: '2026-07-20', risk: 'low' },
  { id: '2', name: '银泰百货消防设施检查', date: '2026-07-18', risk: 'medium' },
  { id: '3', name: '万象城疏散通道评估', date: '2026-07-15', risk: 'high' },
  { id: '4', name: '龙湖天街消防评估', date: '2026-07-12', risk: 'low' },
  { id: '5', name: '恒隆广场安全评估', date: '2026-07-10', risk: 'medium' },
];

export default function HistoryPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchRecords() {
      try {
        const res = await getHistoryList(page);
        setRecords(res.data.records || MOCK_DATA);
      } catch {
        // Fallback to mock data when API is not available
        setRecords(MOCK_DATA);
      } finally {
        setLoading(false);
      }
    }
    fetchRecords();
  }, [page]);

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>历史记录</h1>
      </div>

      {loading ? (
        <div className={styles.loading}>加载中...</div>
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
            {[1, 2, 3].map((p) => (
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
