FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    STREAMLIT_SERVER_HEADLESS=true \
    STREAMLIT_BROWSER_GATHER_USAGE_STATS=false \
    STREAMLIT_SERVER_MAX_UPLOAD_SIZE=32

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY *.py ./

# NACE listesi bu klasörde saklanır; kalıcı olması için volume bağlanır
RUN useradd --create-home uygulama && mkdir -p /app/data && chown uygulama /app/data
USER uygulama

EXPOSE 8501
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8501/_stcore/health')"

CMD ["streamlit", "run", "app.py", "--server.address=0.0.0.0", "--server.port=8501"]
