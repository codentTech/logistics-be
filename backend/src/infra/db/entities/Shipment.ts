import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { BaseEntity } from './BaseEntity';
import { Tenant } from './Tenant';
import { Driver } from './Driver';
import { ShipmentStatusHistory } from './ShipmentStatusHistory';

export enum ShipmentStatus {
  CREATED = 'CREATED',
  ASSIGNED = 'ASSIGNED',
  PICKED_UP = 'PICKED_UP',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
}

@Entity('shipments')
@Index(['tenantId'])
@Index(['driverId'])
export class Shipment extends BaseEntity {
  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column({ type: 'uuid', nullable: true })
  driverId: string | null;

  @ManyToOne(() => Driver, { nullable: true })
  @JoinColumn({ name: 'driverId' })
  driver: Driver | null;

  @Column({
    type: 'enum',
    enum: ShipmentStatus,
    enumName: 'shipment_status_enum',
    default: ShipmentStatus.CREATED,
  })
  status: ShipmentStatus;

  @Column({ type: 'text' })
  pickupAddress: string;

  @Column({ type: 'text' })
  deliveryAddress: string;

  @Column({ type: 'varchar', length: 255 })
  customerName: string;

  @Column({ type: 'varchar', length: 50 })
  customerPhone: string;

  @Column({ type: 'timestamp', nullable: true })
  assignedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  pickedUpAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date | null;

  @OneToMany(() => ShipmentStatusHistory, (history) => history.shipment)
  statusHistory: ShipmentStatusHistory[];
}

