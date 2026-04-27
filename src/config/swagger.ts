import { Application } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import config from './index';
import logger from './logger';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Dawabuyi Backend API',
      version: '1.0.0',
      description: 'A comprehensive e-commerce backend with authentication, RBAC, and real-time features',
      contact: {
        name: 'API Support',
        email: 'support@dawabuyi.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: config.backend.baseUrl,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token',
        },
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Indicates if the request was successful',
            },
            statusCode: {
              type: 'integer',
              description: 'HTTP status code',
            },
            message: {
              type: 'string',
              description: 'Response message',
            },
            data: {
              type: 'object',
              description: 'Response data',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Response timestamp',
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            statusCode: {
              type: 'integer',
              description: 'HTTP status code',
            },
            message: {
              type: 'string',
              description: 'Error message',
            },
            error: {
              type: 'string',
              description: 'Error details',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Error timestamp',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'User ID',
            },
            fullName: {
              type: 'string',
              description: 'User full name',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email',
            },
            role: {
              type: 'string',
              enum: ['USER', 'ADMIN', 'MANAGER'],
              description: 'User role',
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED'],
              description: 'User status',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'User creation date',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'User last update date',
            },
          },
        },
        AuthTokens: {
          type: 'object',
          properties: {
            accessToken: {
              type: 'string',
              description: 'JWT access token',
            },
            refreshToken: {
              type: 'string',
              description: 'JWT refresh token',
            },
            expiresIn: {
              type: 'integer',
              description: 'Token expiration time in seconds',
            },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email',
            },
            password: {
              type: 'string',
              minLength: 8,
              description: 'User password',
            },
          },
        },
        RegisterRequest: {
          type: 'object',
          required: ['fullName', 'email', 'password'],
          properties: {
            fullName: {
              type: 'string',
              description: 'User full name',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email',
            },
            password: {
              type: 'string',
              minLength: 8,
              description: 'User password',
            },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              description: 'Current page number',
            },
            limit: {
              type: 'integer',
              description: 'Items per page',
            },
            total: {
              type: 'integer',
              description: 'Total number of items',
            },
            totalPages: {
              type: 'integer',
              description: 'Total number of pages',
            },
            hasNext: {
              type: 'boolean',
              description: 'Whether there is a next page',
            },
            hasPrev: {
              type: 'boolean',
              description: 'Whether there is a previous page',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    './src/routes/*.ts',
    './src/modules/**/*.routes.ts',
    './src/modules/**/*.controller.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);

export const setupSwagger = (app: Application): void => {
  // Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Dawabuyi Backend API Documentation',
  }));

  // Swagger JSON
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  logger.info(`Swagger API documentation available at ${config.backend.baseUrl}/api-docs`);
};
