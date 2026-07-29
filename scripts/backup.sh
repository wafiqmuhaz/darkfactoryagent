#!/bin/bash

# Dark Factory - Disaster Recovery Backup Script

BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "Starting backup process..."

# 1. Backup SQLite Database
if [ -f "./backend/prisma/dev.db" ]; then
    echo "Backing up SQLite database..."
    cp "./backend/prisma/dev.db" "$BACKUP_DIR/dev.db"
else
    echo "Warning: dev.db not found"
fi

# 2. Backup Redis Data (if container is running)
echo "Triggering Redis BGSAVE..."
docker exec darkfactoryagent-redis-1 redis-cli BGSAVE
sleep 2 # Wait for BGSAVE to start/finish

# Assuming the redis volume is mapped or we can extract dump.rdb
# Using docker cp to safely extract it
echo "Extracting Redis dump..."
docker cp darkfactoryagent-redis-1:/data/dump.rdb "$BACKUP_DIR/dump.rdb" 2>/dev/null || echo "Redis dump extraction failed or skipped"

# 3. Compress Backup
echo "Compressing backup..."
cd ./backups
tar -czf "$(basename "$BACKUP_DIR").tar.gz" "$(basename "$BACKUP_DIR")"
rm -rf "$(basename "$BACKUP_DIR")"
cd ..

echo "Backup completed successfully! Stored in ./backups/$(basename "$BACKUP_DIR").tar.gz"
