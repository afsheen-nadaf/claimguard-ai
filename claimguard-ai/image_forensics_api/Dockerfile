# ClaimGuard Image Forensics Lambda — Container Image
#
# Packages the Smaug AI-Image-Detector model (439M params) directly into the
# Lambda so it runs locally on CPU — no external HuggingFace Space or GCP VM.

FROM public.ecr.aws/lambda/python:3.12

# Copy requirements and install Python packages.
# --timeout 600 and --retries 5 handle slow networks gracefully.
COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir --timeout 600 --retries 5 -r ${LAMBDA_TASK_ROOT}/requirements.txt

# Pre-download the Smaug model during build (~800MB).
# This bakes the model into the image so runtime cold starts don't need
# to download anything — they just load weights into memory (~5-10s).
# Step A: download only (cached once it succeeds)
RUN python3 -c "from huggingface_hub import snapshot_download; snapshot_download('abacusai/Smaug-AI-Image-Detector', cache_dir='/var/task/smaug-model')"

# Step B: verify it loads (fast, can fail and retry without re-downloading)
RUN python3 -c "import glob, sys; path = glob.glob('/var/task/smaug-model/models--abacusai--Smaug-AI-Image-Detector/snapshots/*')[0]; sys.path.insert(0, path); from smaug_image_detect import SmaugImageDetect; SmaugImageDetect.from_pretrained(path); print('Model verified at:', path)"

# Copy the application code and analyzer modules
COPY app.py smaug_local.py ${LAMBDA_TASK_ROOT}/
COPY compression_analyzer.py ${LAMBDA_TASK_ROOT}/
COPY metadata_analyzer.py ${LAMBDA_TASK_ROOT}/
COPY quality_analyzer.py ${LAMBDA_TASK_ROOT}/
COPY review_engine.py ${LAMBDA_TASK_ROOT}/

# Lambda handler
CMD [ "app.lambda_handler" ]
