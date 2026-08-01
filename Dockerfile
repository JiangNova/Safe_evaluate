# ===== 基础镜像 =====
FROM python:3.10-slim

WORKDIR /app

# 安装系统依赖。兼容新版 deb822 与传统 sources.list 格式，
# 避免国内服务器访问 Debian 官方源时长时间阻塞。
RUN set -eux; \
    for sources_file in \
        /etc/apt/sources.list \
        /etc/apt/sources.list.d/debian.sources; do \
        if [ -f "${sources_file}" ]; then \
            sed -i \
                -e 's|deb.debian.org|mirrors.aliyun.com|g' \
                -e 's|security.debian.org|mirrors.aliyun.com|g' \
                "${sources_file}"; \
        fi; \
    done; \
    apt-get update; \
    apt-get install -y --no-install-recommends gcc; \
    rm -rf /var/lib/apt/lists/*

# 安装Python依赖
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/ --trusted-host mirrors.aliyun.com

# 复制代码
COPY backend/ ./backend/
COPY requirement/ ./requirement/

# 创建数据目录
RUN mkdir -p /app/backend/data/reports /app/backend/data/images

EXPOSE 8000

# 生产模式启动（4个worker）
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
