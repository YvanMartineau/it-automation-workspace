import asyncio
import io
import logging
from datetime import datetime, timezone
from typing import Any, Dict

import matplotlib
matplotlib.use("Agg")  # Non-GUI backend for server environments
import matplotlib.pyplot as plt
from jinja2 import Environment, FileSystemLoader, select_autoescape
from weasyprint import HTML

logger = logging.getLogger(__name__)

env = Environment(
    loader=FileSystemLoader("templates"),
    autoescape=select_autoescape(["html", "xml"]),
)


def _generate_fleet_status_donut_svg(online_count: int, offline_count: int) -> str:
    """Generates an in-memory SVG chart for fleet availability status."""
    labels = ["Online", "Offline"]
    sizes = [online_count, offline_count]
    colors = ["#10b981", "#ef4444"]

    if sum(sizes) == 0:
        labels, sizes, colors = ["No Data"], [1], ["#9ca3af"]

    fig, ax = plt.subplots(figsize=(3.5, 2.5), subplot_kw=dict(aspect="equal"))
    wedges, texts, autotexts = ax.pie(
        sizes,
        labels=labels,
        colors=colors,
        autopct="%1.1f%%" if sum(sizes) > 0 else "",
        startangle=140,
        textprops=dict(color="#1f2937", fontsize=8),
        wedgeprops=dict(width=0.4, edgecolor="white", linewidth=2),
    )
    plt.setp(autotexts, size=8, weight="bold")
    ax.set_title("Fleet Status Distribution", fontsize=9, fontweight="bold", pad=10)
    
    plt.tight_layout()
    buffer = io.StringIO()
    plt.savefig(buffer, format="svg", transparent=True)
    plt.close(fig)
    return buffer.getvalue()


def _generate_cpu_load_bar_svg(top_cpu_devices: list) -> str:
    """Generates an in-memory SVG horizontal bar chart for top CPU consumers."""
    if not top_cpu_devices:
        hostnames, cpu_loads = ["No Data"], [0]
    else:
        hostnames = [d.hostname or d.ip_address for d in top_cpu_devices[:5]]
        cpu_loads = [d.cpu_percent or 0.0 for d in top_cpu_devices[:5]]

    fig, ax = plt.subplots(figsize=(4.5, 2.5))
    y_pos = range(len(hostnames))
    
    bars = ax.barh(y_pos, cpu_loads, align="center", color="#2563eb", height=0.5)
    ax.set_yticks(y_pos)
    ax.set_yticklabels(hostnames, fontsize=8)
    ax.invert_yaxis()  # top-down host order
    ax.set_xlabel("CPU Load (%)", fontsize=8)
    ax.set_xlim(0, 100)
    ax.set_title("Top Compute Consumers", fontsize=9, fontweight="bold")
    
    for bar in bars:
        width = bar.get_width()
        ax.text(width + 1, bar.get_y() + bar.get_height()/2, f"{width:.1f}%", 
                va="center", ha="left", fontsize=7, color="#4b5563")

    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    plt.tight_layout()
    
    buffer = io.StringIO()
    plt.savefig(buffer, format="svg", transparent=True)
    plt.close(fig)
    return buffer.getvalue()


async def generate_report_pdf(context: Dict[str, Any]) -> bytes:
    """
    Asynchronously computes vector SVG charts and renders the Jinja2 HTML template to PDF via WeasyPrint.
    """
    loop = asyncio.get_running_loop()

    # 1. Render SVG Charts in ThreadPoolExecutor to prevent event loop blocking
    donut_chart_svg = await loop.run_in_executor(
        None, 
        _generate_fleet_status_donut_svg, 
        context.get("online_devices", 0), 
        len(context.get("offline_devices", []))
    )
    
    bar_chart_svg = await loop.run_in_executor(
        None, 
        _generate_cpu_load_bar_svg, 
        context.get("top_cpu_devices", [])
    )

    now = datetime.now(timezone.utc)
    enriched_context = {
        "generated_at": now.strftime("%Y-%m-%d %H:%M:%S UTC"),
        "report_type": context.get("report_type", "manual").upper(),
        "total_devices": context.get("total_devices", 0),
        "online_devices": context.get("online_devices", 0),
        "offline_devices": context.get("offline_devices", []),
        "offline_count": len(context.get("offline_devices", [])),
        "availability_pct": (
            round((context.get("online_devices", 0) / context["total_devices"]) * 100, 2)
            if context.get("total_devices", 0) > 0 else 0.0
        ),
        "top_cpu_devices": context.get("top_cpu_devices", []),
        "avg_latency_ms": context.get("avg_latency_ms", 0.0),
        "total_audit_events_24h": context.get("total_audit_events_24h", 0),
        "donut_chart_svg": donut_chart_svg,
        "bar_chart_svg": bar_chart_svg,
    }

    template = env.get_template("report.html")
    html_content = template.render(**enriched_context)

    # 2. Render WeasyPrint PDF
    pdf_bytes = await loop.run_in_executor(
        None, lambda: HTML(string=html_content).write_pdf()
    )

    return pdf_bytes