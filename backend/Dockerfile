FROM python:3.12-slim

# ============================================================
# System dependencies
# ============================================================

# nmap:
#   Required by the asset discovery/scanning service.
#
# WeasyPrint / Pango / Cairo:
#   Required for PDF/report generation.
#
# Matplotlib:
#   Required for report charts.

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


# ============================================================
# nmap capabilities
# ============================================================
#
# Allows the non-root application user to perform the raw socket
# operations required for ARP/ICMP discovery.
#
# docker-compose also supplies NET_RAW and NET_ADMIN.
RUN setcap cap_net_raw,cap_net_admin+eip $(which nmap)


# ============================================================
# Application
# ============================================================

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --default-timeout=100 -r requirements.txt

COPY . .

# Non-root application user execution
RUN useradd -m -u 1001 appuser && chown -R appuser /app
USER appuser

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]