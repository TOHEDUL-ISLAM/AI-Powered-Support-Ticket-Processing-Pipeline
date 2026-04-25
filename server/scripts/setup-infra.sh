#!/usr/bin/env bash
# US-1.2: Provision local infrastructure — SQS queues (LocalStack) + PostgreSQL database.
# LocalStack must already be running: `localstack start` from the repo root Python venv.
# This script is idempotent — safe to run multiple times.

set -euo pipefail

ENDPOINT="${LOCALSTACK_ENDPOINT:-http://localhost:4566}"
REGION="${AWS_REGION:-us-east-1}"
DB_URL="${DATABASE_URL:-}"

log() { echo "[setup] $*"; }

# ---------------------------------------------------------------------------
# 1. Wait for LocalStack
# ---------------------------------------------------------------------------
log "Waiting for LocalStack to be ready..."
for i in $(seq 1 30); do
  if curl -sf "${ENDPOINT}/_localstack/health" | grep -q '"sqs"'; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "[setup] ERROR: LocalStack did not become ready after 30s." >&2
    echo "[setup]        Start it with: uv run localstack start  (from the repo root)" >&2
    exit 1
  fi
  sleep 1
done
log "LocalStack is ready."

# ---------------------------------------------------------------------------
# 2. Create SQS queues
# ---------------------------------------------------------------------------
log "Creating SQS queues..."

aws --endpoint-url="$ENDPOINT" --region="$REGION" \
  sqs create-queue --queue-name phase1DLQ \
  --attributes MessageRetentionPeriod=1209600 \
  --output text --query 'QueueUrl' > /dev/null
log "  ✓ phase1DLQ"

aws --endpoint-url="$ENDPOINT" --region="$REGION" \
  sqs create-queue --queue-name phase2DLQ \
  --attributes MessageRetentionPeriod=1209600 \
  --output text --query 'QueueUrl' > /dev/null
log "  ✓ phase2DLQ"

# Fetch DLQ URLs from create-queue output (dynamic — avoids hardcoding account ID)
PHASE1_DLQ_URL=$(aws --endpoint-url="$ENDPOINT" --region="$REGION" \
  sqs get-queue-url --queue-name phase1DLQ \
  --query 'QueueUrl' --output text)

PHASE2_DLQ_URL=$(aws --endpoint-url="$ENDPOINT" --region="$REGION" \
  sqs get-queue-url --queue-name phase2DLQ \
  --query 'QueueUrl' --output text)

PHASE1_DLQ_ARN=$(aws --endpoint-url="$ENDPOINT" --region="$REGION" \
  sqs get-queue-attributes \
  --queue-url="$PHASE1_DLQ_URL" \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' --output text)

PHASE2_DLQ_ARN=$(aws --endpoint-url="$ENDPOINT" --region="$REGION" \
  sqs get-queue-attributes \
  --queue-url="$PHASE2_DLQ_URL" \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' --output text)

# Main queues with redrive policies
PHASE1_REDRIVE="{\"maxReceiveCount\":\"3\",\"deadLetterTargetArn\":\"${PHASE1_DLQ_ARN}\"}"
aws --endpoint-url="$ENDPOINT" --region="$REGION" \
  sqs create-queue --queue-name phase1Queue \
  --attributes "VisibilityTimeout=60,MessageRetentionPeriod=1209600,RedrivePolicy=${PHASE1_REDRIVE}" \
  --output text --query 'QueueUrl' > /dev/null
log "  ✓ phase1Queue  (redrive → phase1DLQ, maxReceiveCount=3)"

PHASE2_REDRIVE="{\"maxReceiveCount\":\"3\",\"deadLetterTargetArn\":\"${PHASE2_DLQ_ARN}\"}"
aws --endpoint-url="$ENDPOINT" --region="$REGION" \
  sqs create-queue --queue-name phase2Queue \
  --attributes "VisibilityTimeout=60,MessageRetentionPeriod=1209600,RedrivePolicy=${PHASE2_REDRIVE}" \
  --output text --query 'QueueUrl' > /dev/null
log "  ✓ phase2Queue  (redrive → phase2DLQ, maxReceiveCount=3)"

# ---------------------------------------------------------------------------
# 3. Create PostgreSQL database
# ---------------------------------------------------------------------------
log "Creating PostgreSQL database..."

if [ -n "$DB_URL" ]; then
  # Extract db name from DATABASE_URL (last path segment)
  DB_NAME=$(echo "$DB_URL" | sed 's|.*/||')
  DB_HOST=$(echo "$DB_URL" | sed 's|.*@||;s|/.*||;s|:.*||')
  DB_PORT=$(echo "$DB_URL" | sed 's|.*:||;s|/.*||')
  DB_USER=$(echo "$DB_URL" | sed 's|.*://||;s|:.*||')

  psql "$DB_URL" -c "SELECT 1" > /dev/null 2>&1 \
    && log "  ✓ Database '${DB_NAME}' already exists." \
    || psql "postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/postgres" \
         -c "CREATE DATABASE \"${DB_NAME}\";" > /dev/null 2>&1 \
    && log "  ✓ Database '${DB_NAME}' created."
else
  # Fallback: create via createdb using default pg socket
  createdb ai_ticket_pipeline 2>/dev/null \
    && log "  ✓ Database 'ai_ticket_pipeline' created." \
    || log "  ✓ Database 'ai_ticket_pipeline' already exists."
fi

log "Done. Infrastructure is ready."
