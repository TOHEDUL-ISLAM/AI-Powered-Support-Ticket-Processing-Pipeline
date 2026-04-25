#!/usr/bin/env bash
# US-1.2: One-shot local environment setup — SQS queues (LocalStack) + PostgreSQL.
# LocalStack must already be running: `uv run localstack start` from the repo root.
# Run via: npm run setup  (from server/)
# Idempotent — safe to run multiple times.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

ENDPOINT="http://localhost:4566"
REGION="${AWS_REGION:-us-east-1}"

log() { echo "[setup] $*"; }
err() { echo "[setup] ERROR: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 1. Prerequisites
# ---------------------------------------------------------------------------
command -v aws  > /dev/null 2>&1 || err "AWS CLI is not installed. See: https://aws.amazon.com/cli/"
command -v psql > /dev/null 2>&1 || err "psql is not available. Install PostgreSQL client tools."

# ---------------------------------------------------------------------------
# 2. Wait for LocalStack SQS
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
log "LocalStack is ready."

# ---------------------------------------------------------------------------
# 3. SQS — DLQs first, then main queues with redrive policies
# ---------------------------------------------------------------------------
log "Provisioning SQS queues..."

aws --endpoint-url="$ENDPOINT" --region="$REGION" \
  sqs create-queue --queue-name phase1DLQ \
  --attributes MessageRetentionPeriod=1209600,VisibilityTimeout=60 \
  --output text --query 'QueueUrl' > /dev/null
log "  ✓ phase1DLQ"

aws --endpoint-url="$ENDPOINT" --region="$REGION" \
  sqs create-queue --queue-name phase2DLQ \
  --attributes MessageRetentionPeriod=1209600,VisibilityTimeout=60 \
  --output text --query 'QueueUrl' > /dev/null
log "  ✓ phase2DLQ"

PHASE1_DLQ_URL=$(aws --endpoint-url="$ENDPOINT" --region="$REGION" \
  sqs get-queue-url --queue-name phase1DLQ --query 'QueueUrl' --output text)

PHASE2_DLQ_URL=$(aws --endpoint-url="$ENDPOINT" --region="$REGION" \
  sqs get-queue-url --queue-name phase2DLQ --query 'QueueUrl' --output text)

PHASE1_DLQ_ARN=$(aws --endpoint-url="$ENDPOINT" --region="$REGION" \
  sqs get-queue-attributes --queue-url="$PHASE1_DLQ_URL" \
  --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)

PHASE2_DLQ_ARN=$(aws --endpoint-url="$ENDPOINT" --region="$REGION" \
  sqs get-queue-attributes --queue-url="$PHASE2_DLQ_URL" \
  --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)

PHASE1_REDRIVE="{\"deadLetterTargetArn\":\"${PHASE1_DLQ_ARN}\",\"maxReceiveCount\":\"3\"}"
aws --endpoint-url="$ENDPOINT" --region="$REGION" \
  sqs create-queue --queue-name phase1Queue \
  --attributes "VisibilityTimeout=90,MessageRetentionPeriod=345600,RedrivePolicy=${PHASE1_REDRIVE}" \
  --output text --query 'QueueUrl' > /dev/null
log "  ✓ phase1Queue  (VisibilityTimeout=90s, redrive → phase1DLQ, maxReceiveCount=3)"

PHASE2_REDRIVE="{\"deadLetterTargetArn\":\"${PHASE2_DLQ_ARN}\",\"maxReceiveCount\":\"3\"}"
aws --endpoint-url="$ENDPOINT" --region="$REGION" \
  sqs create-queue --queue-name phase2Queue \
  --attributes "VisibilityTimeout=90,MessageRetentionPeriod=345600,RedrivePolicy=${PHASE2_REDRIVE}" \
  --output text --query 'QueueUrl' > /dev/null
log "  ✓ phase2Queue  (VisibilityTimeout=90s, redrive → phase2DLQ, maxReceiveCount=3)"

echo ""
echo "  Paste these into your .env:"
echo "  SQS_PHASE1_QUEUE_URL=http://localhost:4566/000000000000/phase1Queue"
echo "  SQS_PHASE2_QUEUE_URL=http://localhost:4566/000000000000/phase2Queue"
echo "  SQS_PHASE1_DLQ_URL=http://localhost:4566/000000000000/phase1DLQ"
echo "  SQS_PHASE2_DLQ_URL=http://localhost:4566/000000000000/phase2DLQ"
echo ""

# ---------------------------------------------------------------------------
# 4. PostgreSQL database
# ---------------------------------------------------------------------------
log "Setting up PostgreSQL database..."

ENV_FILE="$SERVER_DIR/.env"
[ -f "$ENV_FILE" ] || err ".env not found. Run: cp .env.example .env and fill in DATABASE_URL."

DB_URL=$(grep '^DATABASE_URL=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
[ -n "$DB_URL" ] || err "DATABASE_URL is empty in .env. Set it before running setup."

DB_NAME=$(echo "$DB_URL" | sed 's|.*/||' | sed 's|?.*||')
ADMIN_URL=$(echo "$DB_URL" | sed "s|/${DB_NAME}.*|/postgres|")

if psql "$DB_URL" -c "SELECT 1" > /dev/null 2>&1; then
  log "  ✓ Database '${DB_NAME}' already exists."
else
  psql "$ADMIN_URL" -c "CREATE DATABASE \"${DB_NAME}\";" > /dev/null 2>&1
  log "  ✓ Database '${DB_NAME}' created."
fi

log "Done. Local environment is ready."
log "Next: npm run dev"
