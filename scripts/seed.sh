#!/bin/bash

# Database seeding script for Dawabuyi Backend
echo "Seeding database..."

# Run Prisma seed
echo "Running Prisma seed..."
npx prisma db seed

echo "Database seeding completed!"
