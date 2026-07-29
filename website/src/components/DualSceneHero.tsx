import { AppLink } from '../lib/router'
import { getPlatformUrl } from '../lib/external-link'
import styles from './DualSceneHero.module.css'

export function DualSceneHero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.image} role="img" aria-label="左侧自动驾驶赛车与右侧消防安全检查构成的双场景" />
      <div className={styles.vignette} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true" />

      <svg
        className={styles.dataLayer}
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="data-flow" x1="0" x2="1">
            <stop offset="0" stopColor="#53d8ff" stopOpacity="0" />
            <stop offset="0.28" stopColor="#53d8ff" stopOpacity="0.82" />
            <stop offset="0.58" stopColor="#f3b544" stopOpacity="0.95" />
            <stop offset="1" stopColor="#f3b544" stopOpacity="0" />
          </linearGradient>
          <filter id="flow-glow">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          className={styles.flowPath}
          d="M90 660 C 310 610, 430 500, 625 520 S 880 370, 1050 455 S 1330 545, 1540 315"
          fill="none"
          stroke="url(#data-flow)"
          strokeWidth="3"
          filter="url(#flow-glow)"
        />
        <path
          className={styles.flowPathSecondary}
          d="M170 715 C 360 620, 505 670, 675 575 S 945 470, 1130 535 S 1360 470, 1515 390"
          fill="none"
          stroke="url(#data-flow)"
          strokeWidth="1.5"
        />
        {[
          [425, 540],
          [625, 520],
          [800, 450],
          [1050, 455],
          [1280, 525],
        ].map(([cx, cy], index) => (
          <g key={`${cx}-${cy}`} className={styles.node}>
            <circle cx={cx} cy={cy} r={index === 2 ? 7 : 4} />
            <circle className={styles.nodePulse} cx={cx} cy={cy} r={13} />
          </g>
        ))}
      </svg>

      <div className={styles.racingHud} aria-hidden="true">
        <span>AUTONOMOUS RACING</span>
        <strong>128</strong>
        <small>KM/H · TRAJECTORY 03</small>
      </div>

      <div className={styles.detection} aria-hidden="true">
        <span className={styles.detectionLabel}>RISK CHECK · 96%</span>
        <i className={styles.cornerOne} />
        <i className={styles.cornerTwo} />
        <i className={styles.cornerThree} />
        <i className={styles.cornerFour} />
      </div>

      <div className={styles.content}>
        <p className={styles.kicker}>AUTONOMOUS INTELLIGENCE AT THE LIMITS</p>
        <h1 id="hero-title">
          从赛道极限，
          <br />
          到真实世界
        </h1>
        <p className={styles.description}>
          聚焦自动驾驶赛车、极限车辆智能与人工智能行业赋能，研究复杂动态环境中的感知、决策、规划与控制技术。
        </p>
        <div className={styles.actions}>
          <AppLink className="button button--primary" to="/autonomous-racing">
            探索自动驾驶赛车
            <span aria-hidden="true">↗</span>
          </AppLink>
          <AppLink className="button button--glass" to="/ai-empowerment">
            了解AI赋能方案
          </AppLink>
          <a className="button button--glass" href={getPlatformUrl()}>
            进入风险评估平台
            <span aria-hidden="true">↗</span>
          </a>
          <AppLink className="button button--text" to="/collaboration">
            合作共赢
            <span aria-hidden="true">→</span>
          </AppLink>
        </div>
      </div>

      <div className={styles.scrollCue} aria-hidden="true">
        <span />
        SCROLL TO EXPLORE
      </div>
    </section>
  )
}
