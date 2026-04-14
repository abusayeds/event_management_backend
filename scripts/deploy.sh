#!/bin/bash

# Deployment script for Dawabuyi Backend
echo "Deploying Dawabuyi Backend..."

# Set environment
export NODE_ENV=production

# Install dependencies
echo "Installing dependencies..."
pnpm install --prod

# Run database migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Build the application
echo "Building application..."
npm run build

# Start the application
echo "Starting application..."
npm start
