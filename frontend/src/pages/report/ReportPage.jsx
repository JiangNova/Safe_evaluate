import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getReport } from '../../services/api';
import StatCard from './StatCard';
import FindingItem from './FindingItem';
import Button from '../../components/ui/Button';
import styles from './ReportPage.module.css';

export default function ReportPage() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchReport() {
      try {
        const res = await getReport(id);
        setReport(res.data);
      } catch (err) {
        setError('加载报告失败');
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
    return <div className={styles.error}>{error}</div>;
  }

  // Use mock data when API is not available
  const data = report || {
    title: '消防安全评估报告',
    date: '2026-07-23',
    stats: { compliant: 18, nonCompliant: 2, suggestions: 5 },
    findings: [
      {
        severity: 'danger',
        title: '疏散通道宽度不达标',
        detail:
          '二层东侧疏散通道实测宽度1.1m，规范要求≥1.4m（GB 50016 第5.5.18条）',
      },
      {
        severity: 'warning',
        title: '应急照明数量不足',
        detail: '地下停车场B区缺少应急疏散指示灯，建议增设3处',
      },
      {
        severity: 'success',
        title: '自动喷淋系统合规',
        detail: '喷淋头布置密度、覆盖范围、供水压力均符合GB 50084要求',
      },
    ],
  };

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>{data.title}</h1>
        <span className={styles.dateBadge}>{data.date}</span>
      </div>

      <div className={styles.stats}>
        <StatCard
          type="success"
          label="合规项"
          value={data.stats.compliant}
          desc="符合消防规范"
        />
        <StatCard
          type="danger"
          label="不合规项"
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
        <div className={styles.detailTitle}>详细评估分析</div>
        {data.findings.map((f, i) => (
          <FindingItem
            key={i}
            severity={f.severity}
            title={f.title}
            detail={f.detail}
          />
        ))}
      </div>

      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => window.print()}>
          打印报告
        </Button>
        <Button>导出 PDF</Button>
      </div>
    </div>
  );
}
