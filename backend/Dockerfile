FROM python:3.12-slim

# Install system dependencies for nmap and WeasyPrint
RUN apt-get update && apt-get install -y --no-install-recommends \
    nmap \
    libpango-1.0-0 \
    libharfbuzz0b \
    libpangoft2-1.0-0 \
    && rm -rf /var/lib/apt/lists/*
# Grants nmap's binary the raw-socket capability directly, so appuser
# (non-root) can still do ARP/ICMP-based discovery. cap_add on the
# container alone isn't enough — it makes the capability *available*,
# but a non-root process exec'ing an ordinary binary doesn't inherit it
# without this.
RUN setcap cap_net_raw,cap_net_admin+eip $(which nmap)

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Do not run as root — security requirement
RUN useradd -m -u 1001 appuser && chown -R appuser /app
USER appuser

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
