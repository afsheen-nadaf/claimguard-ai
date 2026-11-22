FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/app/cache/huggingface \
    HF_HUB_DISABLE_SYMLINKS_WARNING=1 \
    PORT=8080

WORKDIR /app

# Install minimal OS dependencies for Python image handling & networking
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install CPU-only PyTorch and all pinned dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download and cache Smaug model snapshot during image build
RUN python -c "from huggingface_hub import snapshot_download; snapshot_download('abacusai/Smaug-AI-Image-Detector')"

# Copy service application code
COPY app.py detector.py ./

# Expose container port
EXPOSE 8080

# Start single Uvicorn worker bound to 0.0.0.0 and PORT environment variable
CMD ["sh", "-c", "exec uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1"]
