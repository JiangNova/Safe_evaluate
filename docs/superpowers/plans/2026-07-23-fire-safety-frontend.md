# 消防安全评估系统 前端实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从零搭建消防安全评估系统 React 前端，包含登录、评估、报告、历史四个页面。

**Architecture:** Vite + React 18 单页应用，CSS Modules 做样式隔离，React Router v6 管理路由，Context + useReducer 管理认证状态，axios 处理 HTTP 请求。组件按 pages / components 分层，通用 UI 组件独立复用。

**Tech Stack:** React 18, Vite 5, React Router v6, axios, react-dropzone, CSS Modules

---

## File Map

```
frontend/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx                          # 入口
    ├── App.jsx                           # 路由配置
    ├── index.css                         # 全局样式 + CSS 变量
    ├── context/
    │   └── AuthContext.jsx               # 认证状态 Context
    ├── services/
    │   └── api.js                        # axios 实例 + 拦截器
    ├── components/
    │   ├── ui/
    │   │   ├── Button.jsx + Button.module.css
    │   │   ├── Input.jsx + Input.module.css
    │   │   ├── Loading.jsx + Loading.module.css
    │   ├── layout/
    │   │   ├── AppLayout.jsx + AppLayout.module.css
    │   │   ├── Sidebar.jsx + Sidebar.module.css
    │   │   ├── TopBar.jsx + TopBar.module.css
    │   └── ProtectedRoute.jsx
    └── pages/
        ├── login/
        │   ├── LoginPage.jsx + LoginPage.module.css
        │   ├── BrandPanel.jsx + BrandPanel.module.css
        │   ├── LoginForm.jsx + LoginForm.module.css
        ├── evaluate/
        │   ├── EvaluatePage.jsx + EvaluatePage.module.css
        │   ├── UploadZone.jsx + UploadZone.module.css
        │   ├── RuleSelector.jsx + RuleSelector.module.css
        ├── report/
        │   ├── ReportPage.jsx + ReportPage.module.css
        │   ├── StatCard.jsx + StatCard.module.css
        │   ├── FindingItem.jsx + FindingItem.module.css
        └── history/
            ├── HistoryPage.jsx + HistoryPage.module.css
```

---

### Task 1: 项目脚手架 (Vite + React)

**Files to create:**
- `frontend/package.json`
- `frontend/vite.config.js`
- `frontend/index.html`
- `frontend/src/main.jsx`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "safe-evaluate-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "axios": "^1.7.3",
    "react-dropzone": "^14.2.3"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: 创建 vite.config.js**

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 3: 创建 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>消防安全评估系统</title>
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔥</text></svg>" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: 创建 main.jsx**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 5: 安装依赖**

```bash
cd frontend && npm install
```

- [ ] **Step 6: 验证脚手架运行**

```bash
npm run dev
```
Expected: dev server starts on port 3000, blank page no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold Vite + React project"
```

---

### Task 2: 全局样式与设计系统 (CSS Variables)

**Files to create:**
- `frontend/src/index.css`

- [ ] **Step 1: 创建 index.css**

```css
/* ===== CSS Reset ===== */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
  background-color: var(--bg-page);
}

a {
  color: inherit;
  text-decoration: none;
}

button {
  cursor: pointer;
  border: none;
  background: none;
  font: inherit;
  color: inherit;
}

input {
  font: inherit;
  color: inherit;
  border: none;
  outline: none;
}

ul, ol {
  list-style: none;
}

/* ===== Design Tokens ===== */
:root {
  /* Primary */
  --color-primary: #1a56db;
  --color-primary-light: #eff6ff;
  --color-primary-dark: #1647b8;

  /* Backgrounds */
  --bg-page: #f8fafc;
  --bg-card: #ffffff;
  --bg-dark: #1a2236;
  --bg-dark-start: #101b2e;
  --bg-dark-end: #1e3355;

  /* Text */
  --text-primary: #1a2236;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  --text-placeholder: #94a3b8;

  /* Borders */
  --border-card: #e8ecf1;
  --border-input: #d1d5db;
  --border-dashed: #cbd5e1;

  /* Status colors */
  --color-success: #16a34a;
  --color-success-bg: #f0fdf4;
  --color-success-border: #bbf7d0;
  --color-warning: #d97706;
  --color-warning-bg: #fffbeb;
  --color-warning-border: #fde68a;
  --color-danger: #dc2626;
  --color-danger-bg: #fef2f2;
  --color-danger-border: #fecaca;

  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 24px;
  --spacing-2xl: 32px;

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 10px;
  --radius-xl: 12px;

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 12px rgba(26, 34, 54, 0.06);
  --shadow-lg: 0 4px 24px rgba(26, 34, 54, 0.10);

  /* Layout */
  --sidebar-width: 175px;
}

/* ===== Utilities ===== */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

- [ ] **Step 2: 验证可运行**

```bash
npm run dev
```
Expected: dev server starts, page renders without errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat: add global styles and CSS design tokens"
```

---

### Task 3: 通用 UI 组件 (Button, Input, Loading)

**Files to create:**
- `frontend/src/components/ui/Button.jsx`
- `frontend/src/components/ui/Button.module.css`
- `frontend/src/components/ui/Input.jsx`
- `frontend/src/components/ui/Input.module.css`
- `frontend/src/components/ui/Loading.jsx`
- `frontend/src/components/ui/Loading.module.css`

- [ ] **Step 1: 创建 Button 组件**

`Button.module.css`:
```css
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: 0 24px;
  height: 42px;
  font-size: 14px;
  font-weight: 500;
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
  letter-spacing: 0.5px;
}

.primary {
  background-color: var(--color-primary);
  color: #ffffff;
}

.primary:hover {
  background-color: var(--color-primary-dark);
}

.secondary {
  background-color: var(--bg-card);
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
}

.secondary:hover {
  background-color: var(--color-primary-light);
}

.ghost {
  background-color: transparent;
  color: var(--text-secondary);
}

.ghost:hover {
  background-color: var(--bg-page);
}

.small {
  height: 34px;
  padding: 0 16px;
  font-size: 12px;
}

.large {
  height: 48px;
  padding: 0 36px;
  font-size: 15px;
}

.fullWidth {
  width: 100%;
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

`Button.jsx`:
```jsx
import styles from './Button.module.css';

export default function Button({
  children,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  disabled = false,
  onClick,
  type = 'button',
  className = '',
}) {
  const cls = [
    styles.button,
    styles[variant],
    size !== 'medium' ? styles[size] : '',
    fullWidth ? styles.fullWidth : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={cls} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
```

- [ ] **Step 2: 创建 Input 组件**

`Input.module.css`:
```css
.wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.input {
  height: 42px;
  padding: 0 14px;
  font-size: 14px;
  border: 1px solid var(--border-input);
  border-radius: var(--radius-sm);
  background-color: var(--bg-card);
  color: var(--text-primary);
  transition: border-color 0.2s ease;
}

.input::placeholder {
  color: var(--text-placeholder);
}

.input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(26, 86, 219, 0.1);
}

.inputError {
  border-color: var(--color-danger);
}

.inputError:focus {
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
}

.error {
  font-size: 12px;
  color: var(--color-danger);
}
```

`Input.jsx`:
```jsx
import { forwardRef } from 'react';
import styles from './Input.module.css';

const Input = forwardRef(function Input(
  { label, error, className = '', ...props },
  ref
) {
  return (
    <div className={styles.wrapper}>
      {label && <label className={styles.label}>{label}</label>}
      <input
        ref={ref}
        className={`${styles.input} ${error ? styles.inputError : ''} ${className}`}
        {...props}
      />
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
});

export default Input;
```

- [ ] **Step 3: 创建 Loading 组件**

`Loading.module.css`:
```css
.overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(248, 250, 252, 0.8);
  z-index: 1000;
}

.spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-lg);
}

.ring {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-input);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.text {
  font-size: 13px;
  color: var(--text-secondary);
}

.inline {
  position: static;
  background: none;
}

.inline .ring {
  width: 24px;
  height: 24px;
  border-width: 2px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

`Loading.jsx`:
```jsx
import styles from './Loading.module.css';

export default function Loading({ text = '加载中...', inline = false }) {
  return (
    <div className={`${styles.overlay} ${inline ? styles.inline : ''}`}>
      <div className={styles.spinner}>
        <div className={styles.ring} />
        {text && <span className={styles.text}>{text}</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 验证组件存在，无 import 错误**

```bash
# 暂时不渲染，确认语法正确即可
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/
git commit -m "feat: add Button, Input, and Loading UI components"
```

---

### Task 4: API 服务层 (axios)

**Files to create:**
- `frontend/src/services/api.js`

- [ ] **Step 1: 创建 api.js**

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// ===== Auth APIs =====
export function loginApi(username, password) {
  return api.post('/auth/login', { username, password });
}

// ===== Evaluate APIs =====
export function submitEvaluation(formData) {
  return api.post('/evaluate', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

// ===== Report APIs =====
export function getReport(id) {
  return api.get(`/reports/${id}`);
}

// ===== History APIs =====
export function getHistoryList(page = 1, pageSize = 10) {
  return api.get('/reports', { params: { page, page_size: pageSize } });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/
git commit -m "feat: add axios API service layer with auth interceptors"
```

---

### Task 5: 认证状态管理 (Context + ProtectedRoute)

**Files to create:**
- `frontend/src/context/AuthContext.jsx`
- `frontend/src/components/ProtectedRoute.jsx`

- [ ] **Step 1: 创建 AuthContext**

```jsx
import { createContext, useContext, useReducer, useEffect } from 'react';

const AuthContext = createContext(null);

const initialState = {
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: false,
  isLoading: true,
};

function authReducer(state, action) {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    // On mount, check if token exists and is valid
    // For now, just check localStorage
    if (state.token) {
      // TODO: validate token with backend when API is ready
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: {
          user: { username: localStorage.getItem('username') || '用户' },
          token: state.token,
        },
      });
    } else {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = (user, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('username', user.username);
    dispatch({ type: 'LOGIN_SUCCESS', payload: { user, token } });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    dispatch({ type: 'LOGOUT' });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

- [ ] **Step 2: 创建 ProtectedRoute**

```jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loading from './ui/Loading';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <Loading text="验证身份中..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/context/ frontend/src/components/ProtectedRoute.jsx
git commit -m "feat: add auth context and protected route guard"
```

---

### Task 6: 登录页

**Files to create:**
- `frontend/src/pages/login/BrandPanel.jsx`
- `frontend/src/pages/login/BrandPanel.module.css`
- `frontend/src/pages/login/LoginForm.jsx`
- `frontend/src/pages/login/LoginForm.module.css`
- `frontend/src/pages/login/LoginPage.jsx`
- `frontend/src/pages/login/LoginPage.module.css`

- [ ] **Step 1: 创建 BrandPanel**

`BrandPanel.module.css`:
```css
.panel {
  width: 42%;
  min-height: 100vh;
  background: linear-gradient(160deg, var(--bg-dark-start) 0%, #1a2744 40%, var(--bg-dark-end) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 40px;
  position: relative;
  overflow: hidden;
}

.circle {
  position: absolute;
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 50%;
}

.circleTop {
  top: -60px;
  right: -60px;
  width: 200px;
  height: 200px;
}

.circleBottom {
  bottom: -40px;
  left: -40px;
  width: 140px;
  height: 140px;
}

.content {
  position: relative;
  z-index: 1;
  text-align: center;
}

.icon {
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, #e8501e, var(--color-danger));
  border-radius: var(--radius-xl);
  margin: 0 auto 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}

.title {
  font-size: 22px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.5px;
}

.divider {
  width: 32px;
  height: 2px;
  background: rgba(255, 255, 255, 0.2);
  margin: 16px auto;
}

.subtitle {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.6;
}
```

`BrandPanel.jsx`:
```jsx
import styles from './BrandPanel.module.css';

export default function BrandPanel() {
  return (
    <div className={styles.panel}>
      <div className={`${styles.circle} ${styles.circleTop}`} />
      <div className={`${styles.circle} ${styles.circleBottom}`} />
      <div className={styles.content}>
        <div className={styles.icon}>🔥</div>
        <div className={styles.title}>消防安全评估</div>
        <div className={styles.divider} />
        <div className={styles.subtitle}>
          智能评估 · 精准研判
          <br />
          保障消防安全
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 LoginForm**

`LoginForm.module.css`:
```css
.panel {
  flex: 1;
  min-height: 100vh;
  background: #fafbfc;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.form {
  width: 320px;
}

.header {
  margin-bottom: 28px;
}

.headerTitle {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.headerSub {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

.field {
  margin-bottom: 16px;
}

.submitBtn {
  margin-top: 8px;
}

.errorAlert {
  background: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  font-size: 12px;
  color: var(--color-danger);
  margin-bottom: 16px;
}

.footer {
  font-size: 11px;
  color: var(--text-muted);
  text-align: center;
  margin-top: 20px;
}
```

`LoginForm.jsx`:
```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { loginApi } from '../../services/api';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import styles from './LoginForm.module.css';

export default function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

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
      navigate('/evaluate', { replace: true });
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
```

- [ ] **Step 3: 创建 LoginPage**

`LoginPage.module.css`:
```css
.page {
  display: flex;
  min-height: 100vh;
}
```

`LoginPage.jsx`:
```jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import BrandPanel from './BrandPanel';
import LoginForm from './LoginForm';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/evaluate" replace />;
  }

  return (
    <div className={styles.page}>
      <BrandPanel />
      <LoginForm />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/login/
git commit -m "feat: add login page with split-screen layout"
```

---

### Task 7: 应用壳层 (AppLayout, Sidebar, TopBar)

**Files to create:**
- `frontend/src/components/layout/Sidebar.jsx`
- `frontend/src/components/layout/Sidebar.module.css`
- `frontend/src/components/layout/TopBar.jsx`
- `frontend/src/components/layout/TopBar.module.css`
- `frontend/src/components/layout/AppLayout.jsx`
- `frontend/src/components/layout/AppLayout.module.css`

- [ ] **Step 1: 创建 Sidebar**

`Sidebar.module.css`:
```css
.sidebar {
  width: var(--sidebar-width);
  min-height: 100vh;
  background: var(--bg-card);
  border-right: 1px solid var(--border-card);
  padding: 16px 0;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.brand {
  padding: 4px 18px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.brandIcon {
  font-size: 18px;
}

.brandName {
  font-weight: 700;
  font-size: 13px;
  color: var(--text-primary);
}

.divider {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 6px 16px 4px;
}

.navItem {
  padding: 10px 16px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 2px 0;
}

.navItem:hover {
  background: var(--bg-page);
}

.active {
  color: var(--color-primary);
  background: var(--color-primary-light);
  border-left: 3px solid var(--color-primary);
  padding-left: 13px;
  font-weight: 500;
}

.navItem:not(.active) {
  border-left: 3px solid transparent;
}
```

`Sidebar.jsx`:
```jsx
import { NavLink } from 'react-router-dom';
import styles from './Sidebar.module.css';

const NAV_ITEMS = [
  { path: '/evaluate', label: '新建评估', icon: '📋' },
  { path: '/history', label: '历史记录', icon: '📜' },
  { path: '/rules', label: '规则管理', icon: '📖' },
  { path: '/stats', label: '统计分析', icon: '📊' },
];

export default function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandIcon}>🔥</span>
        <span className={styles.brandName}>消防安全评估</span>
      </div>
      <div className={styles.divider}>功能</div>
      <nav>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.active : ''}`
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: 创建 TopBar**

`TopBar.module.css`:
```css
.topbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 var(--spacing-xl);
  height: 48px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-card);
  flex-shrink: 0;
}

.userInfo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--text-secondary);
}

.avatar {
  width: 30px;
  height: 30px;
  background: var(--color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
  font-weight: 600;
}

.logoutBtn {
  margin-left: 8px;
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
}

.logoutBtn:hover {
  color: var(--color-danger);
}
```

`TopBar.jsx`:
```jsx
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from './TopBar.module.css';

export default function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const initial = user?.username?.charAt(0) || '用';

  return (
    <div className={styles.topbar}>
      <div className={styles.userInfo}>
        <span>{user?.username}</span>
        <div className={styles.avatar}>{initial}</div>
        <button className={styles.logoutBtn} onClick={handleLogout}>
          退出
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 创建 AppLayout**

`AppLayout.module.css`:
```css
.layout {
  display: flex;
  min-height: 100vh;
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.content {
  flex: 1;
  background: var(--bg-page);
  padding: var(--spacing-xl);
  overflow-y: auto;
}
```

`AppLayout.jsx`:
```jsx
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import styles from './AppLayout.module.css';

export default function AppLayout() {
  return (
    <div className={styles.layout}>
      <Sidebar />
      <div className={styles.main}>
        <TopBar />
        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/
git commit -m "feat: add AppLayout with Sidebar and TopBar"
```

---

### Task 8: 评估主页

**Files to create:**
- `frontend/src/pages/evaluate/UploadZone.jsx`
- `frontend/src/pages/evaluate/UploadZone.module.css`
- `frontend/src/pages/evaluate/RuleSelector.jsx`
- `frontend/src/pages/evaluate/RuleSelector.module.css`
- `frontend/src/pages/evaluate/EvaluatePage.jsx`
- `frontend/src/pages/evaluate/EvaluatePage.module.css`

- [ ] **Step 1: 创建 UploadZone**

`UploadZone.module.css`:
```css
.zone {
  background: var(--bg-card);
  border: 2px dashed var(--border-dashed);
  border-radius: var(--radius-lg);
  padding: 40px 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.zone:hover,
.dragging {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.hasFile {
  border-color: var(--color-primary);
  border-style: solid;
  background: var(--color-primary-light);
}

.icon {
  width: 44px;
  height: 44px;
  background: var(--color-primary-light);
  border-radius: var(--radius-lg);
  margin: 0 auto 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.title {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 600;
}

.hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 6px;
}

.formats {
  font-size: 11px;
  color: #c0c8d4;
  margin-top: 8px;
}

.fileInfo {
  font-size: 13px;
  color: var(--color-primary);
  font-weight: 500;
  margin-top: 8px;
}

.removeBtn {
  font-size: 11px;
  color: var(--color-danger);
  margin-top: 8px;
  cursor: pointer;
  display: inline-block;
}

.removeBtn:hover {
  text-decoration: underline;
}
```

`UploadZone.jsx`:
```jsx
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import styles from './UploadZone.module.css';

export default function UploadZone({ file, onFileChange }) {
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        onFileChange(acceptedFiles[0]);
      }
    },
    [onFileChange]
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
    onDropAccepted: () => setIsDragging(false),
    onDropRejected: () => setIsDragging(false),
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp'],
      'application/pdf': ['.pdf'],
    },
    maxSize: 50 * 1024 * 1024,
    multiple: false,
  });

  return (
    <div
      {...getRootProps()}
      className={`${styles.zone} ${isDragging ? styles.dragging : ''} ${file ? styles.hasFile : ''}`}
    >
      <input {...getInputProps()} />
      <div className={styles.icon}>🏗️</div>
      {file ? (
        <>
          <div className={styles.title}>已选择文件</div>
          <div className={styles.fileInfo}>{file.name}</div>
          <div className={styles.formats}>
            {(file.size / 1024 / 1024).toFixed(1)} MB
          </div>
          <span
            className={styles.removeBtn}
            onClick={(e) => {
              e.stopPropagation();
              onFileChange(null);
            }}
          >
            移除文件
          </span>
        </>
      ) : (
        <>
          <div className={styles.title}>上传消防评估资料</div>
          <div className={styles.hint}>
            建筑平面图 · 消防设施布局图 · 疏散路线图
          </div>
          <div className={styles.formats}>
            支持 PNG / JPG / PDF · 最大 50MB
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 创建 RuleSelector**

`RuleSelector.module.css`:
```css
.card {
  background: var(--bg-card);
  border: 1px solid var(--border-card);
  border-radius: var(--radius-lg);
  padding: 22px;
}

.header {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 14px;
}

.rule {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
}

.checkbox {
  width: 18px;
  height: 18px;
  border-radius: var(--radius-sm);
  border: 2px solid var(--border-input);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  transition: all 0.15s ease;
}

.checked {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.ruleName {
  flex: 1;
}

.checkedText {
  color: var(--text-primary);
}

.addMore {
  font-size: 11px;
  color: var(--color-primary);
  margin-top: 12px;
  cursor: pointer;
  display: inline-block;
}

.addMore:hover {
  text-decoration: underline;
}
```

`RuleSelector.jsx`:
```jsx
import { useState } from 'react';
import styles from './RuleSelector.module.css';

const DEFAULT_RULES = [
  { id: 'gb50016', label: 'GB 50016 建筑设计防火规范' },
  { id: 'gb50116', label: 'GB 50116 火灾自动报警系统设计规范' },
  { id: 'gb50974', label: 'GB 50974 消防给水及消火栓系统规范' },
  { id: 'ga653', label: 'GA 653 人员密集场所消防安全管理' },
];

export default function RuleSelector({ selected, onChange }) {
  const [rules] = useState(DEFAULT_RULES);

  function toggleRule(ruleId) {
    if (selected.includes(ruleId)) {
      onChange(selected.filter((id) => id !== ruleId));
    } else {
      onChange([...selected, ruleId]);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>📋 评估规则</div>
      {rules.map((rule) => {
        const isChecked = selected.includes(rule.id);
        return (
          <div
            key={rule.id}
            className={styles.rule}
            onClick={() => toggleRule(rule.id)}
          >
            <div
              className={`${styles.checkbox} ${isChecked ? styles.checked : ''}`}
            >
              {isChecked ? '✓' : ''}
            </div>
            <span
              className={`${styles.ruleName} ${isChecked ? styles.checkedText : ''}`}
            >
              {rule.label}
            </span>
          </div>
        );
      })}
      <div className={styles.addMore}>+ 自定义添加规则</div>
    </div>
  );
}
```

- [ ] **Step 3: 创建 EvaluatePage**

`EvaluatePage.module.css`:
```css
.header {
  margin-bottom: 20px;
}

.title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.subtitle {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}

.footer {
  margin-top: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.estimate {
  font-size: 11px;
  color: var(--text-muted);
}
```

`EvaluatePage.jsx`:
```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UploadZone from './UploadZone';
import RuleSelector from './RuleSelector';
import Button from '../../components/ui/Button';
import Loading from '../../components/ui/Loading';
import { submitEvaluation } from '../../services/api';
import styles from './EvaluatePage.module.css';

export default function EvaluatePage() {
  const [file, setFile] = useState(null);
  const [selectedRules, setSelectedRules] = useState([
    'gb50016',
    'gb50116',
    'gb50974',
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleSubmit() {
    setError('');

    if (!file) {
      setError('请先上传评估资料');
      return;
    }
    if (selectedRules.length === 0) {
      setError('请至少选择一项评估规则');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('rules', JSON.stringify(selectedRules));

      const res = await submitEvaluation(formData);
      navigate(`/report/${res.data.report_id}`);
    } catch (err) {
      setError(err.response?.data?.message || '评估提交失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      {isSubmitting && <Loading text="正在分析评估中，预计 30-60 秒..." />}

      <div className={styles.header}>
        <h1 className={styles.title}>新建消防安全评估</h1>
        <p className={styles.subtitle}>
          上传消防图纸或现场照片，选择评估标准，生成评估报告
        </p>
      </div>

      {error && (
        <div
          style={{
            background: 'var(--color-danger-bg)',
            border: '1px solid var(--color-danger-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            fontSize: '12px',
            color: 'var(--color-danger)',
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
      )}

      <div className={styles.grid}>
        <UploadZone file={file} onFileChange={setFile} />
        <RuleSelector selected={selectedRules} onChange={setSelectedRules} />
      </div>

      <div className={styles.footer}>
        <span className={styles.estimate}>
          评估将调用 AI 模型进行分析，预计耗时 30-60 秒
        </span>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          开始评估
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/evaluate/
git commit -m "feat: add evaluate page with upload zone and rule selector"
```

---

### Task 9: 评估报告页

**Files to create:**
- `frontend/src/pages/report/StatCard.jsx`
- `frontend/src/pages/report/StatCard.module.css`
- `frontend/src/pages/report/FindingItem.jsx`
- `frontend/src/pages/report/FindingItem.module.css`
- `frontend/src/pages/report/ReportPage.jsx`
- `frontend/src/pages/report/ReportPage.module.css`

- [ ] **Step 1: 创建 StatCard**

`StatCard.module.css`:
```css
.card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 16px;
  text-align: center;
  box-shadow: var(--shadow-sm);
}

.cardSuccess {
  border-top: 3px solid var(--color-success);
}

.cardDanger {
  border-top: 3px solid var(--color-danger);
}

.cardWarning {
  border-top: 3px solid var(--color-warning);
}

.label {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.value {
  font-size: 28px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.valueSuccess {
  color: var(--color-success);
}

.valueDanger {
  color: var(--color-danger);
}

.valueWarning {
  color: var(--color-warning);
}

.desc {
  font-size: 10px;
  color: var(--text-secondary);
}
```

`StatCard.jsx`:
```jsx
import styles from './StatCard.module.css';

const TYPE_MAP = {
  success: { card: styles.cardSuccess, value: styles.valueSuccess },
  danger: { card: styles.cardDanger, value: styles.valueDanger },
  warning: { card: styles.cardWarning, value: styles.valueWarning },
};

export default function StatCard({ type = 'success', label, value, desc }) {
  const cls = TYPE_MAP[type] || TYPE_MAP.success;

  return (
    <div className={`${styles.card} ${cls.card}`}>
      <div className={styles.label}>{label}</div>
      <div className={`${styles.value} ${cls.value}`}>{value}</div>
      <div className={styles.desc}>{desc}</div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 FindingItem**

`FindingItem.module.css`:
```css
.item {
  padding: 10px 12px;
  margin-bottom: 8px;
  border-radius: 0 6px 6px 0;
  font-size: 12px;
}

.danger {
  border-left: 3px solid var(--color-danger);
  background: var(--color-danger-bg);
}

.warning {
  border-left: 3px solid var(--color-warning);
  background: var(--color-warning-bg);
}

.success {
  border-left: 3px solid var(--color-success);
  background: var(--color-success-bg);
}

.title {
  font-weight: 500;
}

.titleDanger {
  color: var(--color-danger);
}

.titleWarning {
  color: var(--color-warning);
}

.titleSuccess {
  color: var(--color-success);
}

.detail {
  color: var(--text-secondary);
  margin-top: 2px;
  font-size: 11px;
}
```

`FindingItem.jsx`:
```jsx
import styles from './FindingItem.module.css';

const ICONS = { danger: '🔴', warning: '🟡', success: '🟢' };

export default function FindingItem({ severity = 'success', title, detail }) {
  return (
    <div className={`${styles.item} ${styles[severity]}`}>
      <div className={`${styles.title} ${styles[`title${severity.charAt(0).toUpperCase() + severity.slice(1)}`]}`}>
        {ICONS[severity]} {title}
      </div>
      {detail && <div className={styles.detail}>{detail}</div>}
    </div>
  );
}
```

- [ ] **Step 3: 创建 ReportPage**

`ReportPage.module.css`:
```css
.header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}

.title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.dateBadge {
  font-size: 10px;
  background: #dbeafe;
  color: var(--color-primary);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 18px;
}

.detailCard {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 18px;
  box-shadow: var(--shadow-sm);
  margin-bottom: 16px;
}

.detailTitle {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.actions {
  display: flex;
  gap: 12px;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: var(--text-muted);
  font-size: 14px;
}

.error {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
}
```

`ReportPage.jsx`:
```jsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getReport } from '../../services/api';
import StatCard from './StatCard';
import FindingItem from './FindingItem';
import Button from '../../components/ui/Button';
import styles from './ReportPage.module.css';

export default function ReportPage() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchReport() {
      try {
        const res = await getReport(id);
        setReport(res.data);
      } catch (err) {
        setError('加载报告失败');
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [id]);

  if (loading) {
    return <div className={styles.loading}>加载报告中...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  // Use mock data when API is not available
  const data = report || {
    title: '消防安全评估报告',
    date: '2026-07-23',
    stats: { compliant: 18, nonCompliant: 2, suggestions: 5 },
    findings: [
      {
        severity: 'danger',
        title: '疏散通道宽度不达标',
        detail:
          '二层东侧疏散通道实测宽度1.1m，规范要求≥1.4m（GB 50016 第5.5.18条）',
      },
      {
        severity: 'warning',
        title: '应急照明数量不足',
        detail: '地下停车场B区缺少应急疏散指示灯，建议增设3处',
      },
      {
        severity: 'success',
        title: '自动喷淋系统合规',
        detail: '喷淋头布置密度、覆盖范围、供水压力均符合GB 50084要求',
      },
    ],
  };

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>{data.title}</h1>
        <span className={styles.dateBadge}>{data.date}</span>
      </div>

      <div className={styles.stats}>
        <StatCard
          type="success"
          label="合规项"
          value={data.stats.compliant}
          desc="符合消防规范"
        />
        <StatCard
          type="danger"
          label="不合规项"
          value={data.stats.nonCompliant}
          desc="存在消防隐患"
        />
        <StatCard
          type="warning"
          label="整改建议"
          value={data.stats.suggestions}
          desc="建议限期整改"
        />
      </div>

      <div className={styles.detailCard}>
        <div className={styles.detailTitle}>详细评估分析</div>
        {data.findings.map((f, i) => (
          <FindingItem
            key={i}
            severity={f.severity}
            title={f.title}
            detail={f.detail}
          />
        ))}
      </div>

      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => window.print()}>
          打印报告
        </Button>
        <Button>导出 PDF</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/report/
git commit -m "feat: add report page with stat cards and findings list"
```

---

### Task 10: 历史记录页

**Files to create:**
- `frontend/src/pages/history/HistoryPage.jsx`
- `frontend/src/pages/history/HistoryPage.module.css`

- [ ] **Step 1: 创建 HistoryPage**

`HistoryPage.module.css`:
```css
.header {
  margin-bottom: 18px;
}

.title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.table {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.tableHeader {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  font-size: 11px;
  color: var(--text-muted);
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-card);
  background: #fafbfc;
  font-weight: 500;
}

.row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  font-size: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid #f1f5f9;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s ease;
  align-items: center;
}

.row:hover {
  background: var(--color-primary-light);
}

.row:last-child {
  border-bottom: none;
}

.badge {
  font-weight: 500;
  font-size: 11px;
}

.badgeLow {
  color: var(--color-success);
}

.badgeMedium {
  color: var(--color-warning);
}

.badgeHigh {
  color: var(--color-danger);
}

.viewLink {
  color: var(--color-primary);
  font-size: 11px;
  cursor: pointer;
}

.viewLink:hover {
  text-decoration: underline;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 16px;
  font-size: 12px;
}

.pageBtn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-input);
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s ease;
}

.pageBtn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.pageActive {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: var(--text-muted);
  font-size: 14px;
}

.error {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
}
```

`HistoryPage.jsx`:
```jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHistoryList } from '../../services/api';
import styles from './HistoryPage.module.css';

const RISK_MAP = {
  low: { label: '低风险', cls: styles.badgeLow },
  medium: { label: '中风险', cls: styles.badgeMedium },
  high: { label: '高风险', cls: styles.badgeHigh },
};

// Mock data for development
const MOCK_DATA = [
  { id: '1', name: '万达广场消防安全评估', date: '2026-07-20', risk: 'low' },
  { id: '2', name: '银泰百货消防设施检查', date: '2026-07-18', risk: 'medium' },
  { id: '3', name: '万象城疏散通道评估', date: '2026-07-15', risk: 'high' },
  { id: '4', name: '龙湖天街消防评估', date: '2026-07-12', risk: 'low' },
  { id: '5', name: '恒隆广场安全评估', date: '2026-07-10', risk: 'medium' },
];

export default function HistoryPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchRecords() {
      try {
        const res = await getHistoryList(page);
        setRecords(res.data.records || MOCK_DATA);
      } catch {
        // Fallback to mock data when API is not available
        setRecords(MOCK_DATA);
      } finally {
        setLoading(false);
      }
    }
    fetchRecords();
  }, [page]);

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>历史记录</h1>
      </div>

      {loading ? (
        <div className={styles.loading}>加载中...</div>
      ) : (
        <>
          <div className={styles.table}>
            <div className={styles.tableHeader}>
              <span>评估名称</span>
              <span>评估时间</span>
              <span>风险等级</span>
              <span>操作</span>
            </div>
            {records.map((record) => {
              const risk = RISK_MAP[record.risk] || RISK_MAP.low;
              return (
                <div
                  key={record.id}
                  className={styles.row}
                  onClick={() => navigate(`/report/${record.id}`)}
                >
                  <span>{record.name}</span>
                  <span>{record.date}</span>
                  <span className={`${styles.badge} ${risk.cls}`}>
                    {risk.label}
                  </span>
                  <span
                    className={styles.viewLink}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/report/${record.id}`);
                    }}
                  >
                    查看报告
                  </span>
                </div>
              );
            })}
          </div>

          <div className={styles.pagination}>
            <button
              className={styles.pageBtn}
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              ‹
            </button>
            {[1, 2, 3].map((p) => (
              <button
                key={p}
                className={`${styles.pageBtn} ${page === p ? styles.pageActive : ''}`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
            <button
              className={styles.pageBtn}
              onClick={() => setPage(page + 1)}
            >
              ›
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/history/
git commit -m "feat: add history page with table and pagination"
```

---

### Task 11: App 路由集成

**Files to create/modify:**
- Create: `frontend/src/App.jsx`

- [ ] **Step 1: 创建 App.jsx 路由入口**

```jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/login/LoginPage';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import EvaluatePage from './pages/evaluate/EvaluatePage';
import ReportPage from './pages/report/ReportPage';
import HistoryPage from './pages/history/HistoryPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/evaluate" element={<EvaluatePage />} />
        <Route path="/report/:id" element={<ReportPage />} />
        <Route path="/history" element={<HistoryPage />} />
        {/* Placeholder routes for future pages */}
        <Route path="/rules" element={<div style={{ padding: 24 }}>规则管理（开发中）</div>} />
        <Route path="/stats" element={<div style={{ padding: 24 }}>统计分析（开发中）</div>} />
      </Route>
      <Route path="*" element={<Navigate to="/evaluate" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 2: 验证完整路由可用**

```bash
cd frontend && npm run dev
```

Expected:
- `http://localhost:3000` → 重定向到 `/evaluate`
- `http://localhost:3000/login` → 显示登录页（左右分屏）
- 登录后 → 跳转评估主页（侧边栏 + 内容）
- `/history` → 历史记录表
- `/report/1` → 报告页（含 mock 数据）

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: integrate all routes into App with auth guard"
```

---

### Task 12: 最终验证与打磨

- [ ] **Step 1: 完整启动验证**

```bash
cd frontend && npm run dev
```

检查清单:
- [ ] 登录页：左右分屏显示正确，空值校验，mock 登录跳转 `/evaluate`
- [ ] 评估页：上传区拖拽效果，规则勾选交互，无文件提交提示错误
- [ ] 报告页：统计卡片颜色正确，问题列表按严重程度显示
- [ ] 历史页：表格展示 mock 数据，分页按钮可用，点击跳转报告
- [ ] 侧边栏导航高亮当前页，用户头像显示正确
- [ ] 退出登录跳回登录页
- [ ] 未登录访问 `/evaluate` 跳转到 `/login`

- [ ] **Step 2: 修复 bug（如有）**

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: final polish and verification"
```

---

## 附录: 开发注意事项

1. **CSS Modules 命名**: 使用 camelCase，Vite 自动支持 `*.module.css`
2. **Mock 数据**: ReportPage 和 HistoryPage 已内置 mock 数据，API 不可用时自动回退
3. **文件上传大小限制**: UploadZone 限制 50MB，可在 `useDropzone` 的 `maxSize` 调整
4. **代理配置**: vite.config.js 已配置 `/api` 代理到 `localhost:8000`，后端启动后自动生效
5. **扩展性**: Sidebar 导航项在 `NAV_ITEMS` 数组中配置，添加新页面只需加路由 + 加导航项
