import { aiCapabilities, aiProjects } from '../content/siteContent'
import { getPlatformUrl } from '../lib/external-link'
import styles from './AiEmpowermentPage.module.css'

export function AiEmpowermentPage() {
  return (
    <main id="main-content" className={styles.page}>
      <section className={styles.hero} aria-labelledby="ai-empowerment-title">
        <div className={styles.heroGrid} aria-hidden="true" />
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>AI FOR THE REAL WORLD</p>
          <h1 id="ai-empowerment-title">
            让人工智能，
            <br />
            进入真实行业
          </h1>
          <p className={styles.heroLead}>
            将计算机视觉、多模态大模型与行业知识相结合，为消防、建筑、工业和公共安全场景提供可验证、可落地的智能能力。
          </p>
          <a className="button button--primary" href="#projects">
            查看应用项目
            <span aria-hidden="true">↓</span>
          </a>
        </div>
        <div className={styles.heroSignal} aria-hidden="true">
          <span>VISION</span>
          <span>KNOWLEDGE</span>
          <span>DECISION</span>
          <strong>AI × INDUSTRY</strong>
        </div>
      </section>

      <section className={styles.capabilities} aria-labelledby="capabilities-title">
        <div className={styles.sectionIntro}>
          <p className={styles.sectionLabel}>
            <span>01</span>
            CORE CAPABILITIES
          </p>
          <div>
            <h2 id="capabilities-title">从现场信息到专业行动</h2>
            <p>围绕行业任务构建完整工作链路，让模型输出不止于识别结果。</p>
          </div>
        </div>
        <div className={styles.capabilityGrid}>
          {aiCapabilities.map((capability, index) => (
            <article key={capability.code}>
              <span className={styles.capabilityIndex}>0{index + 1}</span>
              <p>{capability.code}</p>
              <h3>{capability.title}</h3>
              <div>{capability.description}</div>
            </article>
          ))}
        </div>
      </section>

      <section id="projects" className={styles.projects} aria-labelledby="projects-title">
        <div className={styles.projectHeading}>
          <p className={`${styles.sectionLabel} ${styles.onDark}`}>
            <span>02</span>
            APPLICATION PROJECTS
          </p>
          <div>
            <h2 id="projects-title">应用项目</h2>
            <p>从一个经过验证的真实场景开始，持续拓展人工智能的行业边界。</p>
          </div>
        </div>

        <div className={styles.projectGrid}>
          {aiProjects.map((project) => (
            <article key={project.index} className={styles.projectCard}>
              <div className={styles.projectMeta}>
                <span>{project.index}</span>
                <span>{project.eyebrow}</span>
                <strong>{project.status}</strong>
              </div>
              <div className={styles.projectBody}>
                <div>
                  <p className={styles.projectKicker}>CURRENT PROJECT</p>
                  <h3>{project.title}</h3>
                  <p>{project.description}</p>
                </div>
                <ul>
                  {project.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
              {project.platform && (
                <a className={styles.projectAction} href={getPlatformUrl()}>
                  立即体验
                  <span aria-hidden="true">↗</span>
                </a>
              )}
            </article>
          ))}

          <aside className={styles.futureCard} aria-label="未来项目">
            <span>MORE TO COME</span>
            <h3>更多行业项目，持续验证中</h3>
            <p>每个项目将在完成真实场景验证后加入这里，而不是提前展示尚不可用的概念。</p>
          </aside>
        </div>
      </section>
    </main>
  )
}
