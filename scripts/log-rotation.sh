#!/bin/bash

# Log rotation script for Dawabuyi Backend
LOG_DIR="/var/www/dawabuyi-backend/logs"
RETENTION_DAYS=30

echo "Starting log rotation..."

# Create archive directory if it doesn't exist
ARCHIVE_DIR="$LOG_DIR/archive"
mkdir -p $ARCHIVE_DIR

# Compress logs older than 1 day
find $LOG_DIR -name "*.log" -mtime +1 -type f -exec gzip {} \;

# Move compressed logs to archive directory
find $LOG_DIR -name "*.gz" -type f -exec mv {} $ARCHIVE_DIR/ \;

# Remove logs older than retention period
find $ARCHIVE_DIR -name "*.gz" -mtime +$RETENTION_DAYS -type f -delete

# Clean up empty log files
find $LOG_DIR -name "*.log" -type f -size 0 -delete

# Show disk usage
echo "Disk usage after rotation:"
du -sh $LOG_DIR

# Restart application to ensure log files are recreated
if command -v pm2 &> /dev/null; then
    echo "Restarting PM2 processes..."
    pm2 reload dawabuyi-backend
fi

echo "Log rotation completed successfully!"
