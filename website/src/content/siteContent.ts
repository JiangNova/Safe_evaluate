export type NavItem = {
  label: string
  english: string
  path: string
  description: string
}

export const navItems: NavItem[] = [
  {
    label: '首页',
    english: 'Home',
    path: '/',
    description: '认识 AGULAB 的研究使命与核心方向。',
  },
  {
    label: '关于我们',
    english: 'About',
    path: '/about',
    description: '了解 AGULAB 的研究使命、团队文化与发展方向。',
  },
  {
    label: '自动驾驶赛车',
    english: 'Autonomous Racing',
    path: '/autonomous-racing',
    description: '探索极限工况下的车辆感知、规划、决策与控制。',
  },
  {
    label: 'AI赋能',
    english: 'AI Empowerment',
    path: '/ai-empowerment',
    description: '了解人工智能在消防、建筑、工业和公共安全中的应用。',
  },
  {
    label: '科研成果',
    english: 'Research',
    path: '/research',
    description: '科研成果将在获得真实资料后持续更新。',
  },
  {
    label: '实验平台',
    english: 'Platforms',
    path: '/platforms',
    description: '实验平台内容正在随团队建设逐步完善。',
  },
  {
    label: '团队成员',
    english: 'People',
    path: '/people',
    description: '团队成员信息将在正式确认后发布。',
  },
  {
    label: '新闻动态',
    english: 'News',
    path: '/news',
    description: '记录实验室的研究进展、项目过程与重要活动。',
  },
  {
    label: '合作共赢',
    english: 'Collaboration',
    path: '/collaboration',
    description: '面向高校、企业和行业单位，共同探索智能技术的真实价值。',
  },
  {
    label: '联系我们',
    english: 'Contact',
    path: '/contact',
    description: '正式联系信息将在确认后发布。',
  },
]

export const researchPillars = [
  {
    index: '01',
    eyebrow: 'Autonomous Racing',
    title: '自动驾驶赛车',
    description:
      '面向极限工况下的车辆感知、决策、规划与控制，研究人工智能系统在高速、低附着、强非线性和安全约束条件下的性能边界。',
    points: [
      '极限车辆动力学与控制',
      '自动驾驶赛车规划与决策',
      '强化学习与模型预测控制',
      '路面附着系数在线估计',
      '漂移与车辆稳定性控制',
      '仿真、缩比赛车与实车验证',
    ],
    path: '/autonomous-racing',
    tone: 'cool',
  },
  {
    index: '02',
    eyebrow: 'AI Empowerment',
    title: '人工智能赋能',
    description:
      '将计算机视觉、多模态大模型、智能体和自动化决策技术应用于消防、建筑、工业和公共安全领域。',
    points: [
      '消防安全智能检查',
      '建筑与施工现场风险识别',
      '图像、视频和文档多模态分析',
      '智能巡检与自动报告生成',
      '行业知识库与智能问答',
      '企业AI培训与解决方案咨询',
    ],
    path: '/ai-empowerment',
    tone: 'warm',
  },
] as const

export const capabilities = [
  {
    code: 'PERCEPTION',
    title: '多模态感知',
    description: '融合视觉、状态与环境信息，为复杂场景建立可靠理解。',
  },
  {
    code: 'DECISION',
    title: '智能决策',
    description: '面向实时约束与不确定环境，研究安全、高效的决策方法。',
  },
  {
    code: 'PLANNING',
    title: '运动规划',
    description: '在动态边界与极限工况下生成可执行、可验证的运动策略。',
  },
  {
    code: 'CONTROL',
    title: '极限控制',
    description: '将模型、学习与控制相结合，逼近车辆系统的性能边界。',
  },
]

export const platforms = [
  {
    number: '01',
    title: '数字仿真',
    description: '在可复现环境中快速验证算法、场景与系统边界。',
  },
  {
    number: '02',
    title: '缩比赛车',
    description: '连接感知、规划与控制，完成低成本高频率闭环实验。',
  },
  {
    number: '03',
    title: '实车验证',
    description: '面向真实车辆与真实约束，推进系统级研究与迁移。',
  },
]

export const collaborationTypes = [
  '联合科研与平台共建',
  '行业AI解决方案',
  '技术咨询与企业培训',
]
