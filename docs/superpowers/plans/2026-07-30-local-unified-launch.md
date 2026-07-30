# Local Unified Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide one reliable local command that builds and starts the AGULAB website, both evaluation platforms, and the API under production-like same-origin routes without exposing `/website-static/` as an application page.

**Architecture:** Keep the existing production Nginx and Docker topology unchanged. Harden the existing Python integration server so `/website-static/` is treated only as an asset namespace, then add a standard-library Python process orchestrator with a thin PowerShell entry point for Windows users. The launcher builds all frontends, reuses a healthy backend or starts one, selects a free integration port, opens the website, and cleans up only the processes it created.

**Tech Stack:** PowerShell 5+, Python 3.10 standard library, FastAPI/Uvicorn, React/Vite, `unittest`, Playwright CLI.

## Global Constraints

- Do not modify `nginx.conf`, `docker-compose.yml`, production URL paths, backend API paths, authentication behavior, or frontend `dist` directory names.
- Keep production routes exactly `/`, `/evaluate/`, `/evaluate_tianxin/`, `/website-static/`, and `/api/`.
- Bind local services to `127.0.0.1`; do not expose the development launcher on `0.0.0.0`.
- Never stop or replace a process that the launcher did not create.
- If port 8000 is occupied, reuse it only when `http://127.0.0.1:8000/api/health` returns JSON with `"status": "ok"`; otherwise stop with a clear diagnostic.
- If the preferred integration port is occupied, leave that process untouched and select the next available port.
- Build failures must stop startup; never silently serve stale build output.
- Browser auto-open failure must not stop healthy services.
- Preserve unrelated user changes in `frontend/src/pages/history/HistoryPage.jsx`, `frontend/src/pages/history/HistoryPage.module.css`, and other dirty worktree files.

---

## File Structure

- `scripts/serve-integration.py`: same-origin HTTP routing and API proxy; gains a guard for the bare `/website-static` namespace.
- `scripts/test_serve_integration.py`: regression tests for integration route behavior.
- `scripts/local_preview.py`: testable process orchestration, health checks, port selection, build invocation, logging, and cleanup.
- `scripts/test_local_preview.py`: standard-library unit tests for launcher decision logic.
- `scripts/start-local.ps1`: stable one-command Windows entry point that selects the project Python and forwards options.
- `scripts/verify-integration.ps1`: HTTP smoke checks for canonical routes, redirects, assets, and API health.
- `README.md`: one recommended local startup flow and a clearly separated advanced-development section.
- `website/README.md`: explains that direct Vite preview is component-only and that complete navigation uses the root launcher.

---

### Task 1: Harden the static asset namespace

**Files:**
- Modify: `scripts/test_serve_integration.py`
- Modify: `scripts/serve-integration.py`

**Interfaces:**
- Consumes: `IntegrationHandler._handle(send_body=True)` and `_redirect(location)`.
- Produces: requests to `/website-static` and `/website-static/` return `302 Location: /`; `/website-static/assets/...` continues serving files and missing assets continue returning 404.

- [ ] **Step 1: Write the failing integration tests**

Add these methods to `IntegrationHandlerTests`:

```python
def test_bare_website_static_paths_redirect_home(self):
    for path in ("/website-static", "/website-static/"):
        with self.subTest(path=path):
            status, headers, _ = self.request(path)
            self.assertEqual(status, 302)
            self.assertEqual(headers["Location"], "/")

def test_website_static_assets_are_not_rewritten_to_home(self):
    status, _, body = self.request("/website-static/assets/app.js")
    self.assertEqual(status, 200)
    self.assertEqual(body, "website-asset")
    self.assertEqual(
        self.request("/website-static/assets/missing.js")[0],
        404,
    )
```

- [ ] **Step 2: Run the focused tests and verify the new entry-path test fails**

Run:

```powershell
.\.venv\Scripts\python.exe -m unittest `
  scripts.test_serve_integration.IntegrationHandlerTests `
  -v
```

Expected: `test_bare_website_static_paths_redirect_home` fails because the current handler returns a non-redirect response; existing tests remain green.

- [ ] **Step 3: Implement the minimal route guard**

In `IntegrationHandler._handle`, place the exact-entry guard before the existing `path.startswith("/website-static/")` asset branch:

```python
if path in {"/website-static", "/website-static/"}:
    self._redirect("/")
    return

if path.startswith("/website-static/"):
    relative = path.removeprefix("/website-static/")
    self._serve_file(WEBSITE_DIST / relative, WEBSITE_DIST, send_body)
    return
```

Do not change `classify_path`, platform routing, or `_proxy_api`.

- [ ] **Step 4: Run the full integration-server unit suite**

Run:

```powershell
.\.venv\Scripts\python.exe -m unittest scripts.test_serve_integration -v
```

Expected: all tests pass, including asset 404 behavior and platform route isolation.

- [ ] **Step 5: Commit the route regression fix**

```powershell
git add scripts/serve-integration.py scripts/test_serve_integration.py
git commit -m "fix: guard local website asset route"
```

---

### Task 2: Add the unified local process launcher

**Files:**
- Create: `scripts/local_preview.py`
- Create: `scripts/test_local_preview.py`
- Create: `scripts/start-local.ps1`

**Interfaces:**
- Produces: `find_available_port(preferred: int, host: str = "127.0.0.1", attempts: int = 100) -> int`.
- Produces: `backend_state(host: str = "127.0.0.1", port: int = 8000, timeout: float = 1.0) -> str`, returning exactly `"free"`, `"healthy"`, or `"occupied"`.
- Produces: `wait_for_url(url: str, timeout: float = 30.0) -> bool`.
- Produces: CLI `python scripts/local_preview.py [--port 8080] [--skip-build] [--no-browser]`.
- Produces: PowerShell entry `powershell -ExecutionPolicy Bypass -File scripts/start-local.ps1 [-Port 8080] [-SkipBuild] [-NoBrowser]`.

- [ ] **Step 1: Write launcher decision tests**

Create `scripts/test_local_preview.py`:

```python
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import socket
import sys
import threading
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import local_preview


class HealthHandler(BaseHTTPRequestHandler):
    status_value = "ok"

    def do_GET(self):
        body = json.dumps({"status": self.status_value}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass


class LocalPreviewTests(unittest.TestCase):
    def test_find_available_port_skips_an_occupied_port(self):
        occupied = socket.socket()
        occupied.bind(("127.0.0.1", 0))
        occupied.listen()
        try:
            preferred = occupied.getsockname()[1]
            selected = local_preview.find_available_port(
                preferred,
                attempts=10,
            )
            self.assertGreater(selected, preferred)
        finally:
            occupied.close()

    def test_backend_state_reports_free(self):
        probe = socket.socket()
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
        probe.close()
        self.assertEqual(local_preview.backend_state(port=port), "free")

    def test_backend_state_reuses_only_a_healthy_backend(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), HealthHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            port = server.server_address[1]
            self.assertEqual(
                local_preview.backend_state(port=port),
                "healthy",
            )
            HealthHandler.status_value = "not-ok"
            self.assertEqual(
                local_preview.backend_state(port=port),
                "occupied",
            )
        finally:
            HealthHandler.status_value = "ok"
            server.shutdown()
            server.server_close()
            thread.join()

    def test_wait_for_url_times_out_cleanly(self):
        probe = socket.socket()
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
        probe.close()
        self.assertFalse(
            local_preview.wait_for_url(
                f"http://127.0.0.1:{port}/",
                timeout=0.05,
            )
        )


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the launcher tests and verify import failure**

Run:

```powershell
.\.venv\Scripts\python.exe -m unittest scripts.test_local_preview -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'local_preview'`.

- [ ] **Step 3: Implement the tested launcher primitives**

Create `scripts/local_preview.py` with these exact public functions:

```python
def find_available_port(
    preferred: int,
    host: str = "127.0.0.1",
    attempts: int = 100,
) -> int:
    for port in range(preferred, preferred + attempts):
        with socket.socket() as probe:
            try:
                probe.bind((host, port))
            except OSError:
                continue
        return port
    raise RuntimeError(
        f"从端口 {preferred} 开始连续 {attempts} 个端口均被占用。"
    )


def backend_state(
    host: str = "127.0.0.1",
    port: int = 8000,
    timeout: float = 1.0,
) -> str:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            pass
    except OSError:
        return "free"

    try:
        with urlopen(
            f"http://{host}:{port}/api/health",
            timeout=timeout,
        ) as response:
            payload = json.load(response)
        return "healthy" if payload.get("status") == "ok" else "occupied"
    except (OSError, ValueError, json.JSONDecodeError):
        return "occupied"


def wait_for_url(url: str, timeout: float = 30.0) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urlopen(url, timeout=1):
                return True
        except OSError:
            time.sleep(0.2)
    return False
```

Import only Python standard-library modules. `JSONDecodeError` is a `ValueError`, so catching both is permitted but not required.

- [ ] **Step 4: Run the launcher primitive tests**

Run:

```powershell
.\.venv\Scripts\python.exe -m unittest scripts.test_local_preview -v
```

Expected: all four tests pass.

- [ ] **Step 5: Implement orchestration and cleanup**

Add the following behavior to `scripts/local_preview.py`:

```python
PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = PROJECT_ROOT / "output" / "local-preview"


def run_build() -> None:
    completed = subprocess.run(
        [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(PROJECT_ROOT / "scripts" / "build-frontends.ps1"),
        ],
        cwd=PROJECT_ROOT,
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(
            f"前端构建失败，退出码：{completed.returncode}"
        )


def start_process(arguments: list[str], log_name: str) -> subprocess.Popen:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    stdout = (OUTPUT_DIR / f"{log_name}.stdout.log").open(
        "w",
        encoding="utf-8",
    )
    stderr = (OUTPUT_DIR / f"{log_name}.stderr.log").open(
        "w",
        encoding="utf-8",
    )
    process = subprocess.Popen(
        arguments,
        cwd=PROJECT_ROOT,
        stdout=stdout,
        stderr=stderr,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    process._local_preview_logs = (stdout, stderr)
    return process


def stop_created_process(process: subprocess.Popen | None) -> None:
    if process is None or process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)
    for stream in getattr(process, "_local_preview_logs", ()):
        stream.close()
```

Implement `main()` so it:

1. Parses `--port`, `--skip-build`, and `--no-browser`.
2. Runs `run_build()` unless `--skip-build` is present.
3. Calls `backend_state()`.
4. Starts `sys.executable -m uvicorn backend.main:app --host 127.0.0.1 --port 8000` only when state is `"free"`.
5. Raises `RuntimeError("端口 8000 已被非 SafeEvaluate 后端占用。")` when state is `"occupied"`.
6. Waits for `/api/health` after starting the backend.
7. Calls `find_available_port(args.port)` and reports when it selected a different port.
8. Starts `sys.executable scripts/serve-integration.py --port <selected>`.
9. Waits for the integration root URL.
10. Prints the root, `/evaluate/`, and `/evaluate_tianxin/` URLs.
11. Calls `webbrowser.open(root_url)` unless `--no-browser`.
12. Waits for the integration process and handles `KeyboardInterrupt`.
13. In `finally`, terminates only `integration_process` and the backend process created by this invocation.

Close stored log streams even when a process exits before cleanup. Convert top-level `RuntimeError` into a Chinese `错误：...` message and exit code 1 without a traceback.

- [ ] **Step 6: Add the PowerShell entry point**

Create `scripts/start-local.ps1`:

```powershell
[CmdletBinding()]
param(
  [ValidateRange(1, 65535)]
  [int]$Port = 8080,
  [switch]$SkipBuild,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$venvPython = Join-Path $projectRoot '.venv\Scripts\python.exe'

if (Test-Path -LiteralPath $venvPython) {
  $python = $venvPython
} else {
  $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
  if ($null -eq $pythonCommand) {
    throw '未找到 Python；请创建 .venv 或将 python 加入 PATH。'
  }
  $python = $pythonCommand.Source
}

$arguments = @(
  (Join-Path $PSScriptRoot 'local_preview.py'),
  '--port',
  $Port
)
if ($SkipBuild) { $arguments += '--skip-build' }
if ($NoBrowser) { $arguments += '--no-browser' }

& $python @arguments
exit $LASTEXITCODE
```

- [ ] **Step 7: Run launcher tests and syntax checks**

Run:

```powershell
.\.venv\Scripts\python.exe -m unittest `
  scripts.test_local_preview `
  scripts.test_serve_integration `
  -v

$errors = $null
[void][System.Management.Automation.Language.Parser]::ParseFile(
  (Resolve-Path 'scripts/start-local.ps1'),
  [ref]$null,
  [ref]$errors
)
if ($errors.Count -gt 0) { $errors | Format-List; exit 1 }
```

Expected: all Python tests pass and the PowerShell parser reports no errors.

- [ ] **Step 8: Commit the unified launcher**

```powershell
git add `
  scripts/local_preview.py `
  scripts/test_local_preview.py `
  scripts/start-local.ps1
git commit -m "feat: add unified local preview launcher"
```

---

### Task 3: Make the canonical workflow explicit and verify end to end

**Files:**
- Modify: `scripts/verify-integration.ps1`
- Modify: `README.md`
- Modify: `website/README.md`

**Interfaces:**
- Consumes: the launcher CLI from Task 2 and integration routes from Task 1.
- Produces: one documented command, `powershell -ExecutionPolicy Bypass -File scripts/start-local.ps1`, and a smoke verifier accepting `-BaseUrl http://127.0.0.1:<selected-port>`.

- [ ] **Step 1: Extend HTTP verification for canonical redirects**

Add this redirect table near the top of `scripts/verify-integration.ps1`, before the 200-response page checks:

```powershell
$redirectChecks = @(
  @{ Path = '/website-static'; Location = '/' },
  @{ Path = '/website-static/'; Location = '/' },
  @{ Path = '/evaluate'; Location = '/evaluate/' },
  @{ Path = '/evaluate_tianxin'; Location = '/evaluate_tianxin/' }
)

foreach ($check in $redirectChecks) {
  $statusCode = $null
  $location = $null
  try {
    Invoke-WebRequest `
      -Uri "$BaseUrl$($check.Path)" `
      -UseBasicParsing `
      -MaximumRedirection 0
  } catch {
    if ($null -eq $_.Exception.Response) { throw }
    $statusCode = [int]$_.Exception.Response.StatusCode
    $location = $_.Exception.Response.Headers['Location']
  }
  if ($statusCode -ne 302 -or $location -ne $check.Location) {
    throw "Redirect check failed: $($check.Path)"
  }
}
```

Keep the existing page, asset, missing-asset, and API checks.

- [ ] **Step 2: Rewrite README local startup as one canonical flow**

Replace the current separate “启动后端/启动三个前端/同域预览” quick-start sequence with:

```markdown
### 启动完整本地环境（推荐）

在项目根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-local.ps1
```

脚本会构建三个前端、复用或启动后端、选择可用的本地预览端口并打开官网。
终端会打印最终入口：

- `/`：AGULAB 官网
- `/evaluate/`：通用评判平台
- `/evaluate_tianxin/`：天心区消防安全评估系统
- `/api/health`：后端健康检查

默认从 8080 端口开始选择；端口被占用时不会结束占用进程，而会自动选择后续可用端口。
再次启动且构建产物已是最新时，可使用 `-SkipBuild`。不希望自动打开浏览器时，可使用 `-NoBrowser`。
按 `Ctrl+C` 停止本次启动的本地服务。
```

Retain a separate “高级：单应用开发” section for ports 5173, 3001, and 3000. State explicitly that direct Vite Preview is not the complete cross-application environment and should not be used to validate production-like links.

- [ ] **Step 3: Align the website-specific README**

In `website/README.md`, keep component development commands but add:

```markdown
完整联调请从项目根目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-local.ps1
```

请勿使用 `npm run preview` 验证官网到 `/evaluate/` 的跨应用链接；Vite Preview 不实现生产环境的同域路径分流。
```

- [ ] **Step 4: Run all automated checks and production builds**

Run:

```powershell
.\.venv\Scripts\python.exe -m unittest `
  scripts.test_local_preview `
  scripts.test_serve_integration `
  backend.test_config_guard `
  -v

powershell -ExecutionPolicy Bypass -File scripts/build-frontends.ps1
```

Expected: all Python tests, frontend tests, website lint, TypeScript compilation, and all three production builds pass.

- [ ] **Step 5: Start the complete environment through the new entry point**

Use a free preferred port to avoid disturbing unrelated services:

```powershell
powershell -ExecutionPolicy Bypass -File `
  scripts/start-local.ps1 `
  -Port 8081 `
  -SkipBuild `
  -NoBrowser
```

Keep this process running in its own terminal. Record the final URL printed by the launcher.

- [ ] **Step 6: Run HTTP smoke verification**

In another terminal, substitute the actual printed URL:

```powershell
powershell -ExecutionPolicy Bypass -File `
  scripts/verify-integration.ps1 `
  -BaseUrl http://127.0.0.1:8081
```

Expected: `All three frontend routes, assets, and API health passed.`

- [ ] **Step 7: Run real-browser acceptance checks**

Using Playwright CLI:

```powershell
npx --yes --package @playwright/cli playwright-cli open `
  http://127.0.0.1:8081/ `
  --headed
npx --yes --package @playwright/cli playwright-cli snapshot
```

Verify:

1. Desktop homepage renders, not the 404 page.
2. Direct navigation and refresh on `/about` render the website shell.
3. `/website-static/` redirects to `/`.
4. `/evaluate/` renders the public platform.
5. `/evaluate_tianxin/` redirects to its login page and renders the authenticated platform shell.
6. A narrow viewport still exposes the website navigation menu without horizontal overflow.

Capture any acceptance screenshots under `output/playwright/`, which remains ignored by Git.

- [ ] **Step 8: Confirm production configuration is untouched**

Run:

```powershell
git diff --exit-code HEAD -- nginx.conf docker-compose.yml DEPLOY.md
```

Expected: exit code 0 and no output.

- [ ] **Step 9: Commit documentation and verification**

```powershell
git add scripts/verify-integration.ps1 README.md website/README.md
git commit -m "docs: standardize local startup workflow"
```

- [ ] **Step 10: Review final worktree scope**

Run:

```powershell
git status --short
git log -4 --oneline
```

Expected: only the user’s pre-existing unrelated changes remain unstaged; the implementation consists of the design commit, plan commit, and three focused implementation commits.
