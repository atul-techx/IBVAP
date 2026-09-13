import os
import sys
import uvicorn

if __name__ == "__main__":
    raw_port = os.environ.get("PORT", "8000")
    try:
        port = int(raw_port)
    except ValueError:
        port = 8000

    print(f"[+] Starting IBVAP Server on 0.0.0.0:{port} (PORT={raw_port})")
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=port, log_level="info")
