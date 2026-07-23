@echo off
echo ========================================
echo SafeEvaluate Backend Setup
echo ========================================
echo.

echo [1/2] Installing Python dependencies...
pip install fastapi uvicorn[standard] python-multipart python-docx httpx pydantic PyJWT -i https://pypi.tuna.tsinghua.edu.cn/simple --trusted-host pypi.tuna.tsinghua.edu.cn
if %errorlevel% neq 0 (
    echo Retrying with default pip source...
    pip install fastapi uvicorn[standard] python-multipart python-docx httpx pydantic PyJWT
)

echo.
echo [2/2] Creating data directories...
if not exist "backend\data\reports" mkdir backend\data\reports

echo.
echo ========================================
echo Setup complete!
echo.
echo Run the backend with:
echo   uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
echo.
echo Then start the frontend with:
echo   cd frontend
echo   npm run dev
echo ========================================
pause
