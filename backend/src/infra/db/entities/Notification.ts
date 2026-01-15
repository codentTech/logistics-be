import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { User } from './User';
import { Shipment } from './Shipment';

export enum NotificationType {
  SHIPMENT_ASSIGNED = 'SHIPMENT_ASSIGNED',
  SHIPMENT_APPROVED = 'SHIPMENT_APPROVED',
  SHIPMENT_REJECTED = 'SHIPMENT_REJECTED',
  SHIPMENT_CANCELLED = 'SHIPMENT_CANCELLED',
  SHIPMENT_IN_TRANSIT = 'SHIPMENT_IN_TRANSIT',
  SHIPMENT_DELIVERED = 'SHIPMENT_DELIVERED',
}

export enum NotificationStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
}

@Entity('notifications')
@Index(['userId'])
@Index(['shipmentId'])
@Index(['status'])
@Index(['createdAt'])
export class Notification extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  shipmentId: string | null;

  @ManyToOne(() => Shipment, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shipmentId' })
  shipment: Shipment | null;

  @Column({
    type: 'enum',
    enum: NotificationType,
    enumName: 'notification_type_enum',
  })
  type: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    enumName: 'notification_status_enum',
    default: NotificationStatus.UNREAD,
  })
  status: NotificationStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;
}

