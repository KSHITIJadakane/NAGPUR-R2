"""
Root entrypoint proxy for cloud deployers (Railway, Render, Koyeb, etc.)
Exposes the FastAPI 'app' instance from backend.main.
"""
import os
import uvicorn
from backend.main import app

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port)
