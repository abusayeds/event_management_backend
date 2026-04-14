import { NotificationService } from './notification.service';
import { NotificationValidation } from './notification.validation';
import { NotificationController } from './notification.controller';

describe('Notification Module', () => {
  describe('Notification Validation', () => {
    it('should validate create notification payload correctly', () => {
      const validPayload = {
        body: {
          title: 'Test Notification',
          message: 'Test Message',
          type: 'INFO'
        }
      };
      
      const result = NotificationValidation.createNotification.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should validate get notification by id payload correctly', () => {
      const validPayload = {
        params: {
          id: 'notification-id'
        }
      };
      
      const result = NotificationValidation.getNotificationById.safeParse(validPayload);
      expect(result.success).toBe(true);
    });
  });

  describe('Notification Service', () => {
    it('should be defined', () => {
      expect(NotificationService).toBeDefined();
    });
  });

  describe('Notification Controller', () => {
    it('should be defined', () => {
      expect(NotificationController).toBeDefined();
    });
  });
});
