import { UserService } from './user.service';
import { UserValidation } from './user.validation';
import { UserController } from './user.controller';

describe('User Module', () => {
  describe('User Validation', () => {
    it('should validate create user payload correctly', () => {
      const validPayload = {
        body: {
          fullName: 'John Doe',
          email: 'test@example.com',
          password: 'password123',
          roleId: 'role-id'
        }
      };
      
      const result = UserValidation.createUser.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should validate get user by id payload correctly', () => {
      const validPayload = {
        params: {
          id: 'user-id'
        }
      };
      
      const result = UserValidation.getUserById.safeParse(validPayload);
      expect(result.success).toBe(true);
    });
  });

  describe('User Service', () => {
    it('should be defined', () => {
      expect(UserService).toBeDefined();
    });
  });

  describe('User Controller', () => {
    it('should be defined', () => {
      expect(UserController).toBeDefined();
    });
  });
});
