export interface INotification {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  read: boolean;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateNotificationPayload {
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  read?: boolean;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  userId: string;
}

export interface IUpdateNotificationPayload {
  title?: string;
  message?: string;
  type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  read?: boolean;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface INotificationFilters {
  type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  read?: boolean;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  userId?: string;
  search?: string;
}
