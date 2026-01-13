import { Entity, Column, PrimaryColumn, Index } from 'typeorm';

@Entity('dashboard_summary')
@Index(['tenantId'], { unique: true })
export class DashboardSummary {
  @PrimaryColumn({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'int', default: 0 })
  totalShipments: number;

  @Column({ type: 'int', default: 0 })
  activeShipments: number;

  @Column({ type: 'int', default: 0 })
  deliveredToday: number;

  @Column({ type: 'int', default: 0 })
  driversOnline: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastUpdated: Date;
}

