import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { Shipment, ShipmentStatus } from './Shipment';
import { User } from './User';

@Entity('shipment_status_history')
@Index(['shipmentId'])
export class ShipmentStatusHistory extends BaseEntity {
  @Column({ type: 'uuid' })
  shipmentId: string;

  @ManyToOne(() => Shipment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shipmentId' })
  shipment: Shipment;

  @Column({
    type: 'enum',
    enum: ShipmentStatus,
    enumName: 'shipment_status_enum',
  })
  status: ShipmentStatus;

  @Column({ type: 'uuid', nullable: true })
  changedBy: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'changedBy' })
  changedByUser: User | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  changedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;
}

