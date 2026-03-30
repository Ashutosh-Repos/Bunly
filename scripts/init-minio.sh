#!/bin/sh
# MinIO Initialization Script
# Creates the application bucket in PRIVATE mode (matching Railway Buckets).
# No public access policies are applied.

set -e

ALIAS_NAME="local"
MINIO_HOST="http://minio:9000"
BUCKET_NAME="youtube-videos"
ACCESS_KEY="minioadmin"
SECRET_KEY="minioadmin"

echo "⏳ Configuring MinIO client..."
mc alias set "$ALIAS_NAME" "$MINIO_HOST" "$ACCESS_KEY" "$SECRET_KEY"

echo "📦 Creating bucket: $BUCKET_NAME"
if mc ls "$ALIAS_NAME/$BUCKET_NAME" > /dev/null 2>&1; then
  echo "✅ Bucket '$BUCKET_NAME' already exists."
else
  mc mb "$ALIAS_NAME/$BUCKET_NAME"
  echo "✅ Bucket '$BUCKET_NAME' created successfully."
fi

echo "🔒 Bucket is PRIVATE (no public policy — matches Railway Buckets)."
echo "🎉 MinIO initialization complete!"
