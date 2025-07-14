#!/bin/bash

echo "⏳ Waiting for services to be ready..."
timeout 30 bash -c 'until curl -s http://localhost:4599/ > /dev/null 2>&1; do sleep 1; done' || {
    echo -e "\r❌ KMS service not ready"
    exit 1
}

timeout 30 bash -c 'until curl -s http://localhost:8000/ > /dev/null 2>&1; do sleep 1; done' || {
    echo -e "\r❌ DynamoDB service not ready"
    exit 1
}