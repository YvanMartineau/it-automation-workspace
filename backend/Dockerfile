FROM python:3.12-slim

# Install system dependencies for nmap and WeasyPrint
RUN apt-get update && apt-get install -y --no-install-recommends \
    nmap \
    libpango-1.0-0 \
    libharfbuzz0b \
    libpangoft2-1.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
#For the Alembic migrations and the seed data
COPY entrypoint.sh /app/entrypoint.sh

# Do not run as root — security requirement
RUN useradd -m -u 1001 appuser && chown -R appuser /app
USER appuser

ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
