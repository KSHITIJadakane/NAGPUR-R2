"""
Root entrypoint proxy for cloud deployers (Railway, Render, Koyeb, etc.)
Exposes the FastAPI 'app' instance from backend.main.
"""
import os
import sys
import uvicorn
from backend.main import app

if __name__ == "__main__":
    # Force unbuffered standard output so logs appear instantly in Railway/Render
    sys.stdout.reconfigure(line_buffering=True)
    
    raw_port = os.getenv("PORT", "8080")
    try:
        port = int(raw_port)
    except (ValueError, TypeError):
        port = 8080
    host = os.getenv("HOST", "0.0.0.0")
    
    print(f"[NAGPUR-R2] Starting production server on http://{host}:{port}", flush=True)
    uvicorn.run(
        "backend.main:app",
        host=host,
        port=port,
        proxy_headers=True,
        forwarded_allow_ips="*",
        access_log=True,
    )

