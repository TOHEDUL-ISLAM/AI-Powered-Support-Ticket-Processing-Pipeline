#!/usr/bin/env bash
# US-1.2: One-shot local environment setup — PostgreSQL (Docker) + SQS queues (LocalStack).
# LocalStack must already be running: `uv run localstack start` from the repo root.
# Run via: npm run setup  (from server/)
# Idempotent — safe to run multiple times.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

ENDPOINT="http://localhost:4566"
REGION="${AWS_REGION:-us-east-1}"

log() { echo "[setup] $*"; }
err() { echo "[setup] ERROR: $*" >&2; exit 1; }

# awslocal lives in the uv venv at REPO_ROOT — run it from there
awslocal() { (cd "$REPO_ROOT" && uv run awslocal "$@"); }

# ---------------------------------------------------------------------------
# 1. Prerequisites
# ---------------------------------------------------------------------------
docker info > /dev/null 2>&1 || err "Docker is not running. Start it first."
command -v uv > /dev/null 2>&1 || err "uv is not installed. See: https://docs.astral.sh/uv/getting-started/installation/"

# ---------------------------------------------------------------------------
# 2. Start PostgreSQL container
# ---------------------------------------------------------------------------
log "Starting PostgreSQL via Docker Compose..."
docker compose -f "$REPO_ROOT/docker-compose.yml" up -d postgres
log "PostgreSQL container started."

# ---------------------------------------------------------------------------
# 3. Wait for PostgreSQL to be ready
# ---------------------------------------------------------------------------
log "Waiting for PostgreSQL to be ready..."
for i in $(seq 1 30); do
  if docker compose -f "$REPO_ROOT/docker-compose.yml" exec -T postgres \
      pg_isready -U ticket_user -d ai_ticket_pipeline > /dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    err "PostgreSQL did not become ready after 30s. Check: docker compose logs postgres"
  fi
  sleep 1
done
log "  ✓ PostgreSQL is ready."

# ---------------------------------------------------------------------------
# 4. Wait for LocalStack SQS
# ---------------------------------------------------------------------------
log "Waiting for LocalStack to be ready..."
log "(Start it with: uv run localstack start — from the repo root)"

for i in $(seq 1 30); do
  if curl -sf "$ENDPOINT/_localstack/health" 2>/dev/null | grep -q '"sqs"'; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    err "LocalStack did not become ready after 30s. Run: uv run localstack start (from repo root)"
  fi
  sleep 1
done
log "  ✓ LocalStack is ready."

# ---------------------------------------------------------------------------
# 5. SQS — DLQs first, then main queues with redrive policies
# ---------------------------------------------------------------------------
log "Provisioning SQS queues..."

awslocal --region="$REGION" \
  sqs create-queue --queue-name phase1DLQ \
  --attributes '{"MessageRetentionPeriod":"1209600","VisibilityTimeout":"60"}' \
  --output text --query 'QueueUrl' > /dev/null
log "  ✓ phase1DLQ"

awslocal --region="$REGION" \
  sqs create-queue --queue-name phase2DLQ \
  --attributes '{"MessageRetentionPeriod":"1209600","VisibilityTimeout":"60"}' \
  --output text --query 'QueueUrl' > /dev/null
log "  ✓ phase2DLQ"

PHASE1_DLQ_URL=$(awslocal --region="$REGION" \
  sqs get-queue-url --queue-name phase1DLQ --query 'QueueUrl' --output text)

PHASE2_DLQ_URL=$(awslocal --region="$REGION" \
  sqs get-queue-url --queue-name phase2DLQ --query 'QueueUrl' --output text)

PHASE1_DLQ_ARN=$(awslocal --region="$REGION" \
  sqs get-queue-attributes --queue-url="$PHASE1_DLQ_URL" \
  --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)

PHASE2_DLQ_ARN=$(awslocal --region="$REGION" \
  sqs get-queue-attributes --queue-url="$PHASE2_DLQ_URL" \
  --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)

PHASE1_ATTRS=$(printf '{"VisibilityTimeout":"90","MessageRetentionPeriod":"345600","RedrivePolicy":"{\"deadLetterTargetArn\":\"%s\",\"maxReceiveCount\":\"3\"}"}' "$PHASE1_DLQ_ARN")
awslocal --region="$REGION" \
  sqs create-queue --queue-name phase1Queue \
  --attributes "$PHASE1_ATTRS" \
  --output text --query 'QueueUrl' > /dev/null
log "  ✓ phase1Queue  (VisibilityTimeout=90s, redrive → phase1DLQ, maxReceiveCount=3)"

PHASE2_ATTRS=$(printf '{"VisibilityTimeout":"90","MessageRetentionPeriod":"345600","RedrivePolicy":"{\"deadLetterTargetArn\":\"%s\",\"maxReceiveCount\":\"3\"}"}' "$PHASE2_DLQ_ARN")
awslocal --region="$REGION" \
  sqs create-queue --queue-name phase2Queue \
  --attributes "$PHASE2_ATTRS" \
  --output text --query 'QueueUrl' > /dev/null
log "  ✓ phase2Queue  (VisibilityTimeout=90s, redrive → phase2DLQ, maxReceiveCount=3)"

echo ""
echo "  SQS URLs (already in your .env):"
echo "  SQS_PHASE1_QUEUE_URL=http://localhost:4566/000000000000/phase1Queue"
echo "  SQS_PHASE2_QUEUE_URL=http://localhost:4566/000000000000/phase2Queue"
echo "  SQS_PHASE1_DLQ_URL=http://localhost:4566/000000000000/phase1DLQ"
echo "  SQS_PHASE2_DLQ_URL=http://localhost:4566/000000000000/phase2DLQ"
echo ""

log "Done. Local environment is ready."
log "Next: npm run dev"
