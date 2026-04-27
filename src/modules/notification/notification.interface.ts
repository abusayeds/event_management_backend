import { NotificationMedium, NotificationType } from '../../../prisma/generated/enums';
import { PaginationOptions } from '../../interfaces';

export interface ICreateNotificationPayload {
  recipientId: string;
  senderId?: string;
  type: NotificationType;
  medium?: NotificationMedium[];
  title: string;
  message: string;
  image?: string;
  linkId?: string;
  linkType?: string;
  data?: unknown;
}

export interface INotificationFilters {
  isRead?: boolean;
  type?: NotificationType;
}

export interface INotificationListQuery {
  filters: INotificationFilters;
  options: PaginationOptions;
}
