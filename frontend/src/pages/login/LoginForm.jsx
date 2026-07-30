import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { loginApi } from '../../services/api';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import styles from './LoginForm.module.css';
import { getSafeRedirect } from '../../utils/safeRedirect';

export default function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = getSafeRedirect(location.state?.from);

  function validate() {
    const errs = {};
    if (!username.trim()) errs.username = '请输入账号';
    if (!password) errs.password = '请输入密码';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError('');

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});

    setIsSubmitting(true);
    try {
      const res = await loginApi(username, password);
      login({ username }, res.data.token);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const msg =
        err.response?.data?.message || '登录失败，请检查账号密码';
      setServerError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.panel}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.header}>
          <h1 className={styles.headerTitle}>登录系统</h1>
          <p className={styles.headerSub}>请输入您的账号和密码</p>
        </div>

        {serverError && <div className={styles.errorAlert}>{serverError}</div>}

        <div className={styles.field}>
          <Input
            label="账号"
            placeholder="请输入账号"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            error={errors.username}
            autoComplete="username"
          />
        </div>

        <div className={styles.field}>
          <Input
            label="密码"
            type="password"
            placeholder="请输入密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            autoComplete="current-password"
          />
        </div>

        <div className={styles.submitBtn}>
          <Button type="submit" fullWidth disabled={isSubmitting}>
            {isSubmitting ? '登录中...' : '登 录'}
          </Button>
        </div>

        <p className={styles.footer}>公安内部系统 · 仅限授权人员访问</p>
      </form>
    </div>
  );
}
