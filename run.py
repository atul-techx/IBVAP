import os
import sys
import gc

# Enforce strict single-threading and memory allocation caps to prevent Railway/Render 512MB OOM
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"
os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "max_split_size_mb:32"
os.environ["LOW_MEMORY_MODE"] = os.environ.get("LOW_MEMORY_MODE", "1")
os.environ["DISABLE_EASYOCR"] = os.environ.get("DISABLE_EASYOCR", "1")
os.environ["PYTHONUNBUFFERED"] = "1"

gc.collect()

import uvicorn

if __name__ == "__main__":
    raw_port = os.environ.get("PORT", "8000")
    try:
        port = int(raw_port)
    except ValueError:
        port = 8000

    print(f"[+] Starting IBVAP Server on 0.0.0.0:{port} (PORT={raw_port}, LOW_MEMORY_MODE={os.environ.get('LOW_MEMORY_MODE')})")
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=port, log_level="info")
