#!/bin/bash

# Build script for Dawabuyi Backend
echo "Building Dawabuyi Backend..."

# Clean previous build
echo "Cleaning previous build..."
rm -rf dist

# Run type checking
echo "Running type checking..."
npx tsc --noEmit

# Run tests
echo "Running tests..."
npm test

# Build the project
echo "Building project..."
npx tsc

echo "Build completed successfully!"
