import styles from '../App.module.css';

export default function ScenarioCard({ scenario, selected, onSelect }) {
  return (
    <button type="button" className={`${styles.scenarioCard} ${selected ? styles.selectedScenario : ''}`} onClick={() => onSelect(scenario)}>
      <span>FIXED SCENARIO</span>
      <strong>{scenario.name}</strong>
      <p>{scenario.description || scenario.goal_template}</p>
      <small>{scenario.basis_version_ids.length} 项标准 · {scenario.template_version_ids.length} 个模板</small>
    </button>
  );
}
