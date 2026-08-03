import { useState } from 'react';
import { loginLeadershipUser } from '../services/leaderApi';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      onLogin(await loginLeadershipUser({ username: username.trim(), password }));
    } catch (caught) {
      setError(caught?.response?.data?.detail || '登录失败，请检查账号和密码后重试。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-shell">
      <form className="login-panel" onSubmit={submit}>
        <p className="eyebrow">AI WRITING ASSISTANT</p>
        <h1>AI写作助手</h1>
        <p>请使用已分配的账号登录，进入专属文稿工作区。</p>
        {error && <div role="alert" className="status-message is-error">{error}</div>}
        <label className="field"><span>账号</span><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
        <label className="field"><span>密码</span><input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        <button className="primary-button login-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? '正在登录…' : '登录工作台'}</button>
      </form>
    </main>
  );
}
