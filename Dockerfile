FROM python:3.11-slim

WORKDIR /app

# Memory & Thread Optimization for constrained cloud containers (512MB RAM)
ENV PYTHONUNBUFFERED=1
ENV PORT=8000
ENV OMP_NUM_THREADS=1
ENV OPENBLAS_NUM_THREADS=1
ENV MKL_NUM_THREADS=1
ENV VECLIB_MAXIMUM_THREADS=1
ENV NUMEXPR_NUM_THREADS=1
ENV LOW_MEMORY_MODE=1
ENV DISABLE_EASYOCR=1

# Install system dependencies for OpenCV, multimedia, and X11
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    libxcb1 \
    libx11-6 \
    libxext6 \
    libxrender1 \
    libsm6 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies (CPU PyTorch)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application codebase
COPY . .

EXPOSE 8000

CMD ["python", "run.py"]
