import { DataSource, Repository } from 'typeorm';
import { AppDataSource } from '../../../infra/db/data-source';
import { Notification, NotificationType, NotificationStatus } from '../../../infra/db/entities/Notification';
import { User } from '../../../infra/db/entities/User';
import { Shipment } from '../../../infra/db/entities/Shipment';

export class NotificationService {
  private notificationRepository: Repository<Notification>;
  private userRepository: Repository<User>;
  private shipmentRepository: Repository<Shipment>;

  constructor() {
    this.notificationRepository = AppDataSource.getRepository(Notification);
    this.userRepository = AppDataSource.getRepository(User);
    this.shipmentRepository = AppDataSource.getRepository(Shipment);
  }

  /**
   * Create a notification for a user
   */
  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    shipmentId: string | null = null,
    metadata: Record<string, any> | null = null
  ): Promise<Notification> {
    // Validate required fields
    if (!userId || !type || !title || !message) {
      throw new Error(`Invalid notification data: userId=${userId}, type=${type}, title=${title}, message=${message}`);
    }

    // Explicitly set createdAt to current UTC time to avoid timezone issues
    const now = new Date();
    const notification = this.notificationRepository.create({
      userId,
      type,
      title,
      message,
      shipmentId,
      status: NotificationStatus.UNREAD,
      metadata,
      createdAt: now,
      updatedAt: now,
    });

    try {
      const savedNotification = await this.notificationRepository.save(notification);
      return savedNotification;
    } catch (error) {
      throw new Error(`Failed to save notification: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get all notifications for a user
   */
  async getUserNotifications(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ notifications: any[]; total: number }> {
    if (!userId) {
      throw new Error('userId is required to fetch notifications');
    }

    const [notifications, total] = await this.notificationRepository.findAndCount({
      where: { userId },
      relations: ['shipment'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    // Serialize notifications to plain objects to ensure all fields are included
    const serializedNotifications = notifications.map((notification) => {
      // Helper function to convert any date format to ISO string
      const toISOString = (dateValue: any): string => {
        if (!dateValue) {
          return new Date().toISOString();
        }
        if (dateValue instanceof Date) {
          return dateValue.toISOString();
        }
        if (typeof dateValue === 'string') {
          const parsed = new Date(dateValue);
          if (!isNaN(parsed.getTime())) {
            return parsed.toISOString();
          }
        }
        // Fallback to current time if invalid
        return new Date().toISOString();
      };

      return {
        id: String(notification.id),
        userId: String(notification.userId),
        shipmentId: notification.shipmentId ? String(notification.shipmentId) : null,
        type: String(notification.type),
        title: String(notification.title),
        message: String(notification.message),
        status: String(notification.status),
        metadata: notification.metadata || null,
        createdAt: toISOString(notification.createdAt),
        updatedAt: toISOString(notification.updatedAt),
      };
    });

    return { notifications: serializedNotifications, total };
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return await this.notificationRepository.count({
      where: {
        userId,
        status: NotificationStatus.UNREAD,
      },
    });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    notification.status = NotificationStatus.READ;
    return await this.notificationRepository.save(notification);
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      { userId, status: NotificationStatus.UNREAD },
      { status: NotificationStatus.READ }
    );
  }

  /**
   * Create notification for driver when shipment is assigned
   */
  async notifyDriverAssignment(
    driverUserId: string,
    shipmentId: string,
    shipment: Shipment
  ): Promise<Notification> {
    return await this.createNotification(
      driverUserId,
      NotificationType.SHIPMENT_ASSIGNED,
      'New Shipment Assignment',
      `You have been assigned a new shipment. Please review and approve within 5 minutes.`,
      shipmentId,
      {
        shipmentId,
        pickupAddress: shipment.pickupAddress,
        deliveryAddress: shipment.deliveryAddress,
        customerName: shipment.customerName,
        customerPhone: shipment.customerPhone,
      }
    );
  }
}

