"""Start the complete local AGULAB environment with production-like routes."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time
from urllib.request import urlopen
import webbrowser


PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = PROJECT_ROOT / "output" / "local-preview"
BACKEND_HEALTH_URL = "http://127.0.0.1:8000/api/health"


def find_available_port(
    preferred: int,
    host: str = "127.0.0.1",
    attempts: int = 100,
) -> int:
    """Return the first bindable local port at or above ``preferred``."""
    final_port = min(65536, preferred + attempts)
    for port in range(preferred, final_port):
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
    """Return ``free``, ``healthy``, or ``occupied`` for the backend port."""
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
    except (OSError, ValueError):
        return "occupied"


def wait_for_url(url: str, timeout: float = 30.0) -> bool:
    """Poll a URL until it responds or the timeout expires."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urlopen(url, timeout=1):
                return True
        except OSError:
            time.sleep(0.2)
    return False


def run_build() -> None:
    """Build and test all three frontends using the existing release script."""
    powershell = shutil.which("powershell") or shutil.which("pwsh")
    if powershell is None:
        raise RuntimeError("未找到 PowerShell，无法运行前端构建脚本。")

    completed = subprocess.run(
        [
            powershell,
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


def start_process(
    arguments: list[str],
    log_name: str,
) -> subprocess.Popen:
    """Start a hidden child process and retain its log handles for cleanup."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    stdout = (OUTPUT_DIR / f"{log_name}.stdout.log").open(
        "w",
        encoding="utf-8",
    )
    stderr = (OUTPUT_DIR / f"{log_name}.stderr.log").open(
        "w",
        encoding="utf-8",
    )
    try:
        process = subprocess.Popen(
            arguments,
            cwd=PROJECT_ROOT,
            stdout=stdout,
            stderr=stderr,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except BaseException:
        stdout.close()
        stderr.close()
        raise

    process._local_preview_logs = (stdout, stderr)
    return process


def stop_created_process(process: subprocess.Popen | None) -> None:
    """Stop one child created by this launcher and close its log streams."""
    if process is None:
        return

    try:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
    finally:
        for stream in getattr(process, "_local_preview_logs", ()):
            stream.close()


def parse_args(arguments: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="启动 AGULAB 完整本地同域预览环境。"
    )
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--skip-build", action="store_true")
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args(arguments)
    if not 1 <= args.port <= 65535:
        parser.error("--port 必须在 1 到 65535 之间。")
    return args


def main(arguments: list[str] | None = None) -> int:
    args = parse_args(arguments)
    backend_process = None
    integration_process = None

    try:
        if not args.skip_build:
            print("正在构建并测试三个前端……", flush=True)
            run_build()

        state = backend_state()
        if state == "occupied":
            raise RuntimeError("端口 8000 已被非 SafeEvaluate 后端占用。")
        if state == "free":
            print("正在启动 SafeEvaluate 后端……", flush=True)
            backend_process = start_process(
                [
                    sys.executable,
                    "-m",
                    "uvicorn",
                    "backend.main:app",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    "8000",
                ],
                "backend",
            )
            if not wait_for_url(BACKEND_HEALTH_URL, timeout=60):
                raise RuntimeError(
                    "后端启动失败，请查看 "
                    "output/local-preview/backend.stderr.log。"
                )
        else:
            print("复用已运行的健康后端：http://127.0.0.1:8000", flush=True)

        selected_port = find_available_port(args.port)
        if selected_port != args.port:
            print(
                f"端口 {args.port} 已被占用，改用 {selected_port}。",
                flush=True,
            )

        root_url = f"http://127.0.0.1:{selected_port}/"
        print("正在启动同域集成预览……", flush=True)
        integration_process = start_process(
            [
                sys.executable,
                str(PROJECT_ROOT / "scripts" / "serve-integration.py"),
                "--port",
                str(selected_port),
            ],
            "integration",
        )
        if not wait_for_url(root_url, timeout=30):
            raise RuntimeError(
                "集成预览启动失败，请查看 "
                "output/local-preview/integration.stderr.log。"
            )

        print("", flush=True)
        print(f"AGULAB 官网：{root_url}", flush=True)
        print(f"通用评判平台：{root_url}evaluate/", flush=True)
        print(
            f"消防安全评估系统：{root_url}evaluate_tianxin/",
            flush=True,
        )
        print("按 Ctrl+C 停止本次启动的服务。", flush=True)

        if not args.no_browser and not webbrowser.open(root_url):
            print("浏览器未能自动打开，请手动访问上方官网地址。", flush=True)

        return_code = integration_process.wait()
        if return_code != 0:
            raise RuntimeError(
                f"集成预览意外退出，退出码：{return_code}。"
            )
        return 0
    except KeyboardInterrupt:
        print("\n正在停止本地服务……", flush=True)
        return 0
    finally:
        stop_created_process(integration_process)
        stop_created_process(backend_process)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as error:
        print(f"错误：{error}", file=sys.stderr, flush=True)
        raise SystemExit(1)
