import styles from '../App.module.css';

export default function StepIndicator({ steps, current }) {
  return (
    <ol className={styles.steps} aria-label="评估进度">
      {steps.map((step, index) => {
        const number = index + 1;
        const state = number < current ? 'done' : number === current ? 'active' : 'pending';
        return (
          <li key={step} className={styles[`step_${state}`]}>
            <span>{number < current ? '✓' : number}</span>
            <strong>{step}</strong>
          </li>
        );
      })}
    </ol>
  );
}

