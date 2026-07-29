import { DualSceneHero } from '../components/DualSceneHero'
import {
  capabilities,
  collaborationTypes,
  platforms,
  researchPillars,
} from '../content/siteContent'
import { AppLink } from '../lib/router'
import { getPlatformUrl } from '../lib/external-link'
import styles from './HomePage.module.css'

function ArrowIcon() {
  return <span aria-hidden="true">↗</span>
}

export function HomePage() {
  return (
    <main id="main-content">
      <DualSceneHero />

      <section className={`${styles.section} ${styles.introduction}`}>
        <div className={styles.sectionLabel}>
          <span>01</span>
          ABOUT AGULAB
        </div>
        <div className={styles.introGrid}>
          <h2>
            研究高动态<span className={styles.noBreak}>自主智能</span>，服务真实社会需求
          </h2>
          <div>
            <p className={styles.lead}>
              AGULAB
              面向复杂环境中的自主智能系统，重点开展自动驾驶赛车、极限车辆动力学、智能规划控制、多模态感知与人工智能行业应用研究。
            </p>
            <p>
              我们以赛车这一高动态、高风险、高实时性平台验证人工智能算法的性能边界，并探索将相关能力迁移至消防安全、工程检查、工业运维和公共安全等真实场景。
            </p>
          </div>
        </div>
        <div className={styles.keywords} aria-label="研究关键词">
          {[
            'Autonomous Racing',
            'Embodied Intelligence',
            'AI Safety',
            'Industry Empowerment',
          ].map((keyword, index) => (
            <span key={keyword}>
              <i>0{index + 1}</i>
              {keyword}
            </span>
          ))}
        </div>
      </section>

      <section className={`${styles.section} ${styles.researchSection}`}>
        <div className={styles.sectionHeading}>
          <div className={styles.sectionLabel}>
            <span>02</span>
            RESEARCH PILLARS
          </div>
          <div>
            <h2>两大研究主线</h2>
            <p>同一套智能核心，连接极限验证与真实世界。</p>
          </div>
        </div>

        <div className={styles.pillarGrid}>
          {researchPillars.map((pillar) => (
            <article
              key={pillar.title}
              className={`${styles.pillarCard} ${
                pillar.tone === 'warm' ? styles.warm : styles.cool
              }`}
            >
              <div className={styles.pillarTop}>
                <span>{pillar.index}</span>
                <span>{pillar.eyebrow}</span>
              </div>
              <h3>{pillar.title}</h3>
              <p>{pillar.description}</p>
              <ul>
                {pillar.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <AppLink to={pillar.path}>
                进入{pillar.title}研究
                <ArrowIcon />
              </AppLink>
              {pillar.path === '/ai-empowerment' && (
                <a href={getPlatformUrl()} className={styles.platformEntry}>
                  体验消防安全风险评估
                  <ArrowIcon />
                </a>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className={`${styles.section} ${styles.capabilitiesSection}`}>
        <div className={styles.sectionHeading}>
          <div className={styles.sectionLabel}>
            <span>03</span>
            CORE CAPABILITIES
          </div>
          <div>
            <h2>从感知到控制的完整闭环</h2>
            <p>围绕复杂动态环境，构建可迁移、可验证的自主智能能力。</p>
          </div>
        </div>
        <div className={styles.capabilityGrid}>
          {capabilities.map((capability, index) => (
            <article key={capability.code}>
              <div className={styles.capabilityIndex}>0{index + 1}</div>
              <span>{capability.code}</span>
              <h3>{capability.title}</h3>
              <p>{capability.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={`${styles.section} ${styles.platformSection}`}>
        <div className={styles.platformIntro}>
          <div className={styles.sectionLabel}>
            <span>04</span>
            EXPERIMENTAL LOOP
          </div>
          <h2>多层级实验验证</h2>
          <p>
            从数字环境到真实车辆，逐层缩小算法与真实世界之间的距离。具体平台信息将在建设过程中持续更新。
          </p>
          <AppLink className={styles.inlineLink} to="/platforms">
            查看实验平台
            <ArrowIcon />
          </AppLink>
        </div>
        <div className={styles.platformList}>
          {platforms.map((platform) => (
            <article key={platform.number}>
              <span>{platform.number}</span>
              <div>
                <h3>{platform.title}</h3>
                <p>{platform.description}</p>
              </div>
              <span className={styles.platformLine} aria-hidden="true" />
            </article>
          ))}
        </div>
      </section>

      <section className={`${styles.section} ${styles.trustSection}`}>
        <div className={styles.sectionHeading}>
          <div className={styles.sectionLabel}>
            <span>05</span>
            BUILDING TOGETHER
          </div>
          <div>
            <h2>一支正在成长的年轻团队</h2>
            <p>如实记录每一步，让成员、项目与成果随实验室共同生长。</p>
          </div>
        </div>
        <div className={styles.trustGrid}>
          {[
            ['科研成果', '论文、竞赛与项目成果将在正式确认后持续发布。', '/research'],
            ['团队成员', '成员资料将在团队组建与信息确认后正式呈现。', '/people'],
            ['新闻动态', '记录实验室建设、研究过程与重要活动。', '/news'],
          ].map(([title, description, path], index) => (
            <AppLink key={title} to={path}>
              <span className={styles.buildingTag}>
                <i />
                BUILDING 0{index + 1}
              </span>
              <h3>{title}</h3>
              <p>{description}</p>
              <ArrowIcon />
            </AppLink>
          ))}
        </div>
      </section>

      <section className={styles.collaboration}>
        <div className={styles.collaborationGlow} aria-hidden="true" />
        <div className={styles.collaborationMain}>
          <div className={styles.sectionLabel}>
            <span>06</span>
            COLLABORATION
          </div>
          <p className={styles.collaborationKicker}>AI FOR THE REAL WORLD</p>
          <h2>
            让前沿智能，
            <br />
            回应真实需求
          </h2>
          <p>
            面向高校、企业与行业单位，探索自主智能技术从科研验证到场景落地的更多可能。
          </p>
          <AppLink className="button button--primary" to="/collaboration">
            开启合作
            <span aria-hidden="true">↗</span>
          </AppLink>
        </div>
        <div className={styles.collaborationTypes}>
          {collaborationTypes.map((type, index) => (
            <div key={type}>
              <span>0{index + 1}</span>
              <p>{type}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
