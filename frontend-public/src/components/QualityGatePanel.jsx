import styles from '../App.module.css';

export default function QualityGatePanel({ quality, values = {}, definitions = [] }) {
  const localMissing = definitions.filter((field) => field.required && !values[field.key]?.value).map((field) => field.label);
  const blocking = quality ? !quality.can_finalize : localMissing.length > 0;
  return (
    <section className={`${styles.statusPanel} ${blocking ? styles.blockingPanel : ''}`}>
      <strong>{blocking ? '阻止定稿' : '质量校验'}</strong>
      <span>{blocking ? '仍有内容待人工补充或校验' : '当前未发现阻断项'}</span>
      {localMissing.length > 0 && <small>待人工补充：{localMissing.join('、')}</small>}
      {quality?.messages?.map((message) => <p key={message}>{message}</p>)}
    </section>
  );
}
