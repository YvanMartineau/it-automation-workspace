FROM python:3.12-slim

# Install system dependencies for nmap, WeasyPrint, and Matplotlib
RUN apt-get update && apt-get install -y --no-install-recommends \
    nmap \
    libcap2-bin \
    build-essential \
    pkg-config \
    python3-dev \
    # WeasyPrint / Pango / Cairo rendering libraries
    libpango-1.0-0 \
    libharfbuzz0b \
    libpangoft2-1.0-0 \
    libpango1.0-dev \
    libcairo2-dev \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    gobject-introspection \
    shared-mime-info \
    # System fonts for Matplotlib and WeasyPrint charts
    fonts-dejavu-core \
    fontconfig \
    && rm -rf /var/lib/apt/lists/*
# Grants nmap's binary the raw-socket capability directly, so appuser
# (non-root) can still do ARP/ICMP-based discovery. cap_add on the
# container alone isn't enough — it makes the capability *available*,
# but a non-root process exec'ing an ordinary binary doesn't inherit it
# without this.
RUN setcap cap_net_raw,cap_net_admin+eip $(which nmap)

# Grant nmap binary raw-socket capability for non-root ARP/ICMP discovery
RUN setcap cap_net_raw,cap_net_admin+eip $(which nmap)

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --default-timeout=100 -r requirements.txt

COPY . .

# Non-root application user execution
RUN useradd -m -u 1001 appuser && chown -R appuser /app
USER appuser

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]