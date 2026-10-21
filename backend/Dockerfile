FROM python:3.12-slim

WORKDIR /app

# Sistem bağımlılıkları
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libffi-dev && rm -rf /var/lib/apt/lists/*

# Mevcut proje kaynak kodunu kopyala
COPY --from=src /opt/proje-marta-tr /src

# Backend bağımlılıkları
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Backend kodu
COPY main.py .

ENV PYTHONPATH="/src:/app"
ENV UVICORN_HOST="0.0.0.0"
ENV UVICORN_PORT="30206"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "30206"]
