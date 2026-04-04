# Backend: Python 3.11 + Java 17 JRE (for Ontop CLI)
FROM python:3.11-slim

# Install Eclipse Temurin JRE 17
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://packages.adoptium.net/artifactory/api/gpg/key/public | \
      tee /etc/apt/keyrings/adoptium.asc > /dev/null && \
    echo "deb [signed-by=/etc/apt/keyrings/adoptium.asc] https://packages.adoptium.net/artifactory/deb $(cat /etc/os-release | grep VERSION_CODENAME | cut -d= -f2) main" | \
      tee /etc/apt/sources.list.d/adoptium.list > /dev/null && \
    apt-get update && \
    apt-get install -y --no-install-recommends temurin-17-jre && \
    apt-get purge -y curl && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
