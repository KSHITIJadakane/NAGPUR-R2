"""
Root entrypoint proxy for cloud deployers (Railway, Render, Koyeb, etc.)
Exposes the FastAPI 'app' instance from backend.main.
"""
from backend.main import app

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
