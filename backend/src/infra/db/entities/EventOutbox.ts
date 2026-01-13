import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './BaseEntity';

export enum EventOutboxStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
  DEAD_LETTER = 'DEAD_LETTER',
}

@Entity('event_outbox')
@Index(['tenantId'])
@Index(['status'])
@Index(['status', 'createdAt'])
export class EventOutbox extends BaseEntity {
  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  eventType: string;

  @Column({ type: 'uuid' })
  aggregateId: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({
    type: 'enum',
    enum: EventOutboxStatus,
    enumName: 'event_outbox_status_enum',
    default: EventOutboxStatus.PENDING,
  })
  status: EventOutboxStatus;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date | null;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;
}

