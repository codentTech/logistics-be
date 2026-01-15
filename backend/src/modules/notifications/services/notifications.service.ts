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
    const notification = this.notificationRepository.create({
      userId,
      type,
      title,
      message,
      shipmentId,
      status: NotificationStatus.UNREAD,
      metadata,
    });

    return await this.notificationRepository.save(notification);
  }

  /**
   * Get all notifications for a user
   */
  async getUserNotifications(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ notifications: Notification[]; total: number }> {
    const [notifications, total] = await this.notificationRepository.findAndCount({
      where: { userId },
      relations: ['shipment'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { notifications, total };
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

