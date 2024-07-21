#!/bin/bash

# Exit on error
set -e

# Variables
REPO=$1
PR_NUMBER=$2
IMAGE_NAME="pr-${PR_NUMBER}-${REPO}"
CONTAINER_NAME="${IMAGE_NAME}_container"
PUBLIC_IP="52.91.235.15"  # Your Ubuntu instance's public IP address
PORT=5000  # Fixed port

# Build the Docker image
echo "Building Docker image..."
docker build -t ${IMAGE_NAME} . > build.log 2>&1

# Stop and remove any existing container with the same name
docker rm -f ${CONTAINER_NAME} || true

# Run the new container
echo "Running Docker container on port ${PORT}..."
docker run -d --name ${CONTAINER_NAME} -p ${PORT}:5000 ${IMAGE_NAME} > container.log 2>&1

# Get the URL of the deployed service
DEPLOYMENT_URL="http://${PUBLIC_IP}:${PORT}"

echo "Deployment URL: ${DEPLOYMENT_URL}"

# Print the deployment URL for the bot to capture
echo ${DEPLOYMENT_URL}
