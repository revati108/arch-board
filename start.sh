#!/bin/bash

# ArchBoard Startup Script
# Starts both the main app in separate foot terminal

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Starting ArchBoard..."

# Start the main app in a new foot terminal
foot -T "ArchBoard - Main" bash -c "cd '$DIR' && python main.py; read -p 'Press enter to close...'" &

echo "ArchBoard started!"
echo "  - Main app: http://localhost:5000"
