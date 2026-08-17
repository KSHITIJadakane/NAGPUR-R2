"""
Root entrypoint proxy for cloud deployers (Railway, Render, Koyeb, etc.)
Exposes the FastAPI 'app' instance from backend.main.
"""
import os
import uvicorn
from backend.main import app

if __name__ == "__main__":
    raw_port = os.getenv("PORT", "8000")
    try:
        port = int(raw_port)
    except ValueError:
        port = 8000
    host = os.getenv("HOST", "0.0.0.0")
    print(f"Starting NAGPUR-R2 server on {host}:{port}")
    uvicorn.run(app, host=host, port=port)
