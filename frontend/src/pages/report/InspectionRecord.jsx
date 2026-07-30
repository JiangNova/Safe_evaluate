import styles from './InspectionRecord.module.css';

const FIELD_LABELS = {
  unit_name: '单位名称',
  address: '地址',
  building_area: '建筑面积',
  floors: '建筑层数',
  building_height: '建筑高度',
  unit_nature: '单位性质',
};

const LEGAL_LABELS = {
  fire_acceptance: '建筑物消防验收',
  completion_filing: '消防竣工验收备案',
  pre_opening_check: '公众聚集场所营业前消防检查',
};

const MGMT_LABELS = {
  safety_system: '消防安全制度',
  staff_training: '员工消防安全教育培训',
  fire_inspection: '防火检查',
  emergency_plan: '灭火和应急疏散预案',
  hazardous_with_residence: '易燃易爆场所与居住场所同建筑',
  other_notes: '其他情况',
};

const FP_LABELS = {
  fire_lane: '消防车通道',
  evacuation_route: '疏散通道、安全出口',
  fire_door: '防火门',
  exit_signs: '疏散指示标志',
  emergency_lighting: '应急照明',
  window_obstruction: '外墙门窗逃生障碍物',
  other_notes: '其他情况',
};

const FAC_LABELS = {
  indoor_hydrant: '室内消火栓',
  fire_extinguisher: '灭火器',
  facility_inspection: '建筑消防设施检测',
  property_maintenance: '物业消防设施维护管理',
  other_notes: '其他情况',
};

const CD_LABELS = {
  safety_manager: '消防安全管理人',
  work_system: '消防安全工作制度',
  fire_safety_convention: '防火安全公约',
  fire_education: '消防宣传教育',
  fire_safety_check: '防火安全检查',
  water_source_lane_equipment: '消防水源/通道/器材',
  fire_org: '多种形式消防组织',
};

function FieldRow({ label, value }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className={styles.fieldRow}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.fieldValue}>{String(value)}</span>
    </div>
  );
}

function CheckGroup({ title, data, labels }) {
  if (!data) return null;
  const entries = Object.entries(labels)
    .map(([key, label]) => ({ key, label, value: data[key] }))
    .filter((e) => e.value !== undefined && e.value !== null && e.value !== '');

  if (entries.length === 0) return null;

  return (
    <div className={styles.checkGroup}>
      <div className={styles.groupTitle}>{title}</div>
      {entries.map((e) => (
        <FieldRow key={e.key} label={e.label} value={e.value} />
      ))}
    </div>
  );
}

export default function InspectionRecord({ data }) {
  if (!data) return null;

  return (
    <div className={styles.container}>
      <div className={styles.sectionHeader}>
        <h2>📋 公安派出所日常消防监督检查记录</h2>
        <span className={styles.subtitle}>（根据图片评估结果填充）</span>
      </div>

      <div className={styles.body}>
        {/* Unit info */}
        <div className={styles.infoGrid}>
          <FieldRow label={FIELD_LABELS.unit_name} value={data.unit_name} />
          <FieldRow label={FIELD_LABELS.address} value={data.address} />
          <FieldRow label={FIELD_LABELS.building_area} value={data.building_area} />
          <FieldRow label={FIELD_LABELS.floors} value={data.floors} />
          <FieldRow label={FIELD_LABELS.building_height} value={data.building_height} />
          <FieldRow label={FIELD_LABELS.unit_nature} value={data.unit_nature} />
        </div>

        {/* Legal checks */}
        <CheckGroup
          title="一、合法性检查"
          data={data.legal_checks}
          labels={LEGAL_LABELS}
        />

        {/* Safety management */}
        <CheckGroup
          title="二、消防安全管理"
          data={data.safety_management}
          labels={MGMT_LABELS}
        />

        {/* Fire protection */}
        <CheckGroup
          title="三、建筑防火"
          data={data.fire_protection}
          labels={FP_LABELS}
        />

        {/* Fire facilities */}
        <CheckGroup
          title="四、消防设施"
          data={data.fire_facilities}
          labels={FAC_LABELS}
        />

        {/* Committee duties */}
        <CheckGroup
          title="五、村（居）民委员会消防安全职责"
          data={data.committee_duties}
          labels={CD_LABELS}
        />

        {/* Rectification & referral */}
        {data.rectification_order_number && (
          <FieldRow label="责令改正通知书编号" value={data.rectification_order_number} />
        )}
        {data.referral_items && data.referral_items.violation_items && data.referral_items.violation_items !== '无' && (
          <div className={styles.referralBox}>
            <div className={styles.groupTitle}>六、移送消防机构处理</div>
            <FieldRow label="违法项" value={data.referral_items.violation_items} />
            <FieldRow label="处理内容" value={data.referral_items.description} />
          </div>
        )}

        {data.notes && <FieldRow label="备注" value={data.notes} />}
      </div>
    </div>
  );
}
