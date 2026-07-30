import styles from './App.module.css';
import { platformContent } from './content/platformContent';

function App() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="返回 AGULAB 官网">
          <span className={styles.brandMark} aria-hidden="true">
            A
          </span>
          <span>AGULAB</span>
        </a>
        <span className={styles.status}>{platformContent.status}</span>
      </header>

      <main>
        <section className={styles.hero} aria-labelledby="platform-title">
          <p className={styles.eyebrow}>{platformContent.eyebrow}</p>
          <h1 id="platform-title">{platformContent.title}</h1>
          <p className={styles.description}>{platformContent.description}</p>
        </section>

        <section
          className={styles.workflow}
          aria-label="规划中的评判流程"
        >
          <div className={styles.sectionHeading}>
            <p>PLANNED WORKFLOW</p>
            <span>四个模块将随服务方案逐步开放</span>
          </div>

          <div className={styles.cardGrid}>
            {platformContent.inputAreas.map((area) => (
              <article className={styles.card} key={area.id}>
                <div className={styles.cardTopline}>
                  <span>{area.step}</span>
                  <span className={styles.cardDot} aria-hidden="true" />
                </div>
                <h2>{area.title}</h2>
                <p>{area.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.actionPanel} aria-label="平台开放状态">
          <div>
            <p className={styles.actionLabel}>NEXT STEP</p>
            <p className={styles.actionNote}>
              具体评判对象与流程确认后开放
            </p>
          </div>
          <button
            type="button"
            disabled={!platformContent.actionEnabled}
          >
            开始评判
          </button>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>AGULAB</span>
        <span>Technology for dependable decisions.</span>
      </footer>
    </div>
  );
}

export default App;
