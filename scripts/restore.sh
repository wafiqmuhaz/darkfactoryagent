#!/bin/bash

# Dark Factory - Disaster Recovery Restore Script

if [ -z "$1" ]; then
    echo "Usage: ./restore.sh <backup_file.tar.gz>"
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found!"
    exit 1
fi

echo "Stopping services for restoration..."
docker-compose stop

echo "Extracting backup..."
BACKUP_DIR=$(basename "$BACKUP_FILE" .tar.gz)
tar -xzf "$BACKUP_FILE" -C ./backups/

# 1. Restore SQLite Database
if [ -f "./backups/$BACKUP_DIR/dev.db" ]; then
    echo "Restoring SQLite database..."
    cp "./backups/$BACKUP_DIR/dev.db" "./backend/prisma/dev.db"
fi

# 2. Restore Redis Data
if [ -f "./backups/$BACKUP_DIR/dump.rdb" ]; then
    echo "Restoring Redis data..."
    # Copy to volume
    docker run --rm -v darkfactoryagent_redis_data:/data -v "$(pwd)/backups/$BACKUP_DIR:/backup" alpine cp /backup/dump.rdb /data/dump.rdb
fi

# Cleanup extracted dir
rm -rf "./backups/$BACKUP_DIR"

echo "Restoration complete! Starting services..."
docker-compose up -d

echo "System recovered successfully!"
