@echo off
echo Starting SafeEvaluate Backend on port 8000...
cd /d "%~dp0"
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
pause
