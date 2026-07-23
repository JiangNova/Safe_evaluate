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
    overall_assessment: '该场所整体消防安全状况良好，大部分消防设施符合规范要求，但存在个别疏散通道和标识方面的问题，建议限期整改。',
    stats: { compliant: 3, nonCompliant: 2, suggestions: 2 },
    findings: [
      {
        severity: 'success',
        title: '灭火器配置合规',
        detail: '现场配置的灭火器类型、数量、位置均符合要求，且在有效期内。',
        regulation_ref: '《消防监督检查规定》第XX条',
      },
      {
        severity: 'success',
        title: '自动喷淋系统运行正常',
        detail: '喷淋头布置密度、覆盖范围、供水压力均符合规范要求。',
        regulation_ref: 'GB 50084 自动喷水灭火系统设计规范',
      },
      {
        severity: 'success',
        title: '安全出口标识清晰',
        detail: '各楼层安全出口标识醒目，符合疏散指示要求。',
        regulation_ref: 'GB 50016 建筑设计防火规范',
      },
      {
        severity: 'danger',
        title: '疏散通道宽度不达标',
        detail: '二层东侧疏散通道实测宽度约1.1m，规范要求疏散通道净宽度不应小于1.4m，存在人员疏散拥堵风险，一旦发生火灾可能造成严重后果。',
        regulation_ref: 'GB 50016 建筑设计防火规范 第5.5.18条',
      },
      {
        severity: 'warning',
        title: '应急照明数量不足',
        detail: '地下停车场B区缺少应急疏散指示灯，现有照明不足以在断电情况下引导人员安全疏散，建议增设3处应急照明灯具。',
        regulation_ref: 'GB 50116 火灾自动报警系统设计规范',
      },
    ],
  };

  // Split findings into pass/fail for clear display
  const passItems = data.findings.filter(f => f.severity === 'success');
  const failItems = data.findings.filter(f => f.severity === 'danger' || f.severity === 'warning');

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>{data.title}</h1>
        <span className={styles.dateBadge}>{data.date}</span>
      </div>

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

      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => window.print()}>
          打印报告
        </Button>
        <Button>导出 PDF</Button>
      </div>
    </div>
  );
}
