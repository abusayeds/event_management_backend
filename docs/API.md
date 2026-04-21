# Dawabuyi Backend API Documentation

## Overview

Dawabuyi Backend is a Node.js/Express API built with TypeScript, providing authentication, user management, product catalog, and notification services.

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis
- **Authentication**: JWT
- **Validation**: Zod
- **Testing**: Jest
- **Documentation**: Swagger/OpenAPI

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- pnpm

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd dawabuyi-backend

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env

# Run database migrations
npx prisma migrate dev

# Seed the database
npm run seed

# Start development server
npm run dev
```

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/dawabuyi

# JWT
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret

# Redis
REDIS_URL=redis://localhost:6379

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# AWS (for file uploads)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket
```

## API Endpoints

### Authentication

#### Register
```
POST /api/auth/register
Content-Type: application/json

{
  "fullName": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

#### Refresh Token
```
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "refresh-token-here"
}
```

### Users

#### Get All Users
```
GET /api/users?page=1&limit=10&search=john
Authorization: Bearer <access-token>
```

#### Get User by ID
```
GET /api/users/:id
Authorization: Bearer <access-token>
```

#### Update User
```
PUT /api/users/:id
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "fullName": "John Updated",
  "email": "john.updated@example.com"
}
```

### Connections

#### Send Connection Request
```
POST /api/connections/requests
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "receiverId": "target-user-id"
}
```

#### Get Accepted Connections
```
GET /api/connections/my?page=1&limit=10
Authorization: Bearer <access-token>
```

#### Get Received Requests
```
GET /api/connections/requests/received?page=1&limit=10
Authorization: Bearer <access-token>
```

#### Get Sent Requests
```
GET /api/connections/requests/sent?page=1&limit=10
Authorization: Bearer <access-token>
```

#### Accept Request
```
PATCH /api/connections/requests/:id/accept
Authorization: Bearer <access-token>
```

#### Reject Request
```
PATCH /api/connections/requests/:id/reject
Authorization: Bearer <access-token>
```

#### Cancel Sent Request
```
DELETE /api/connections/requests/:id
Authorization: Bearer <access-token>
```

#### Remove Accepted Connection
```
DELETE /api/connections/:id
Authorization: Bearer <access-token>
```

### Products

#### Get All Products
```
GET /api/products?page=1&limit=10&category=electronics
```

#### Get Product by ID
```
GET /api/products/:id
```

#### Create Product
```
POST /api/products
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "name": "Product Name",
  "description": "Product Description",
  "price": 99.99,
  "categoryId": "category-id"
}
```

### Notifications

#### Get User Notifications
```
GET /api/notifications?page=1&limit=10&unreadOnly=true
Authorization: Bearer <access-token>
```

#### Mark Notification as Read
```
PUT /api/notifications/:id/read
Authorization: Bearer <access-token>
```

## Error Handling

The API returns standard HTTP status codes and error responses:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

## Rate Limiting

- General endpoints: 100 requests per 15 minutes
- Authentication endpoints: 10 requests per 15 minutes

## Security

- JWT tokens with short expiration (15 minutes)
- Refresh tokens with longer expiration (7 days)
- Password hashing with bcrypt
- Rate limiting on sensitive endpoints
- CORS configuration
- Helmet for security headers

## Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- auth.test.ts
```

## Deployment

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Docker
```bash
docker build -t dawabuyi-backend .
docker run -p 8082:8082 dawabuyi-backend
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License.
