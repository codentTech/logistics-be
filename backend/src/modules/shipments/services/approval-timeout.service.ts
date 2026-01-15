import { DataSource } from 'typeorm';
import { AppDataSource } from '../../../infra/db/data-source';
import { Shipment, ShipmentStatus } from '../../../infra/db/entities/Shipment';
import { Driver } from '../../../infra/db/entities/Driver';
import { ShipmentService } from './shipments.service';
import { NotificationService } from '../../notifications/services/notifications.service';
import { NotificationType } from '../../../infra/db/entities/Notification';
import { Server as SocketIOServer } from 'socket.io';

const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface PendingApproval {
  shipmentId: string;
  driverId: string;
  tenantId: string;
  assignedAt: Date;
  timeoutId: NodeJS.Timeout;
}

export class ApprovalTimeoutService {
  private pendingApprovals: Map<string, PendingApproval> = new Map();
  private shipmentService: ShipmentService;
  private notificationService: NotificationService;
  private io: SocketIOServer | null;

  constructor(io?: SocketIOServer) {
    this.shipmentService = new ShipmentService();
    this.notificationService = new NotificationService();
    this.io = io || null;
  }

  /**
   * Schedule auto-reject for a shipment assignment
   */
  scheduleAutoReject(
    shipmentId: string,
    driverId: string,
    tenantId: string,
    assignedAt: Date
  ): void {
    // Clear any existing timeout for this shipment
    this.cancelAutoReject(shipmentId);

    const timeoutId = setTimeout(async () => {
      try {
        await this.autoReject(shipmentId, driverId, tenantId);
      } catch (error) {
        console.error(`Error auto-rejecting shipment ${shipmentId}:`, error);
      } finally {
        this.pendingApprovals.delete(shipmentId);
      }
    }, APPROVAL_TIMEOUT_MS);

    this.pendingApprovals.set(shipmentId, {
      shipmentId,
      driverId,
      tenantId,
      assignedAt,
      timeoutId,
    });
  }

  /**
   * Cancel auto-reject for a shipment (e.g., when approved/rejected manually)
   */
  cancelAutoReject(shipmentId: string): void {
    const pending = this.pendingApprovals.get(shipmentId);
    if (pending) {
      clearTimeout(pending.timeoutId);
      this.pendingApprovals.delete(shipmentId);
    }
  }

  /**
   * Auto-reject a shipment after timeout
   */
  private async autoReject(
    shipmentId: string,
    driverId: string,
    tenantId: string
  ): Promise<void> {
    const shipmentRepository = AppDataSource.getRepository(Shipment);
    const shipment = await shipmentRepository.findOne({
      where: { id: shipmentId, tenantId },
      relations: ['driver'],
    });

    if (!shipment) {
      return; // Shipment not found or already handled
    }

    // Only auto-reject if still in ASSIGNED status with pending approval
    if (shipment.status !== ShipmentStatus.ASSIGNED || !shipment.pendingApproval) {
      return; // Already approved/rejected or status changed
    }

    // Get driver's user ID
    const driverRepository = AppDataSource.getRepository(Driver);
    const driver = await driverRepository.findOne({
      where: { id: driverId, tenantId },
      relations: ['user'],
    });

    if (!driver?.userId) {
      return; // Driver not found
    }

    // Reject the assignment (revert to CREATED)
    await this.shipmentService.rejectAssignment(
      shipmentId,
      tenantId,
      driver.userId,
      driverId
    );

    // Create notification for auto-rejection
    await this.notificationService.createNotification(
      driver.userId,
      NotificationType.SHIPMENT_REJECTED,
      'Shipment Auto-Rejected',
      'The shipment assignment was automatically rejected due to timeout (5 minutes).',
      shipmentId,
      { shipmentId, driverId, autoRejected: true }
    );

    // Emit Socket.IO events
    if (this.io) {
      this.io.to(`tenant:${tenantId}`).emit('shipment-status-update', {
        shipmentId,
        newStatus: ShipmentStatus.CREATED,
        driverId: null,
        pendingApproval: false,
        autoRejected: true,
      });

      this.io.to(`user:${driver.userId}`).emit('notification', {
        type: 'SHIPMENT_REJECTED',
        title: 'Shipment Auto-Rejected',
        message: 'The shipment assignment was automatically rejected due to timeout (5 minutes).',
        shipmentId,
        timestamp: new Date().toISOString(),
        autoRejected: true,
      });
    }
  }

  /**
   * Get all pending approvals
   */
  getPendingApprovals(): PendingApproval[] {
    return Array.from(this.pendingApprovals.values());
  }

  /**
   * Clean up on shutdown
   */
  cleanup(): void {
    for (const pending of this.pendingApprovals.values()) {
      clearTimeout(pending.timeoutId);
    }
    this.pendingApprovals.clear();
  }
}

