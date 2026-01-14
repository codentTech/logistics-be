import { DataSource } from 'typeorm';
import { AppDataSource } from '../../../infra/db/data-source';
import { Shipment, ShipmentStatus } from '../../../infra/db/entities/Shipment';
import { ShipmentStatusHistory } from '../../../infra/db/entities/ShipmentStatusHistory';
import { Driver } from '../../../infra/db/entities/Driver';
import { UserRole } from '../../../infra/db/entities/User';
import { ShipmentRepository } from '../repositories/shipments.repository';
import { ShipmentStateMachine } from '../../../domain/stateMachines/shipment.state-machine';
import { ShipmentEventType, ShipmentEvent } from '../../../domain/events/shipment.events';
import { AppError, ErrorCode } from '../../../shared/errors/error-handler';
import { CreateShipmentDto, AssignDriverDto, UpdateShipmentStatusDto } from '../dto/shipments.dto';
import { EventPublisherService } from '../../../infra/queues/event-publisher.service';

export class ShipmentService {
  private shipmentRepository: ShipmentRepository;
  private eventPublisher: EventPublisherService;

  constructor() {
    this.shipmentRepository = new ShipmentRepository();
    this.eventPublisher = new EventPublisherService();
  }

  async createShipment(
    tenantId: string,
    createDto: CreateShipmentDto,
    userId: string
  ): Promise<Shipment> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create shipment
      const shipment = await this.shipmentRepository.create({
        tenantId,
        status: ShipmentStatus.CREATED,
        pickupAddress: createDto.pickupAddress,
        deliveryAddress: createDto.deliveryAddress,
        customerName: createDto.customerName,
        customerPhone: createDto.customerPhone,
      });

      const savedShipment = await queryRunner.manager.save(shipment);

      // Create status history
      const history = await this.shipmentRepository.addStatusHistory({
        shipmentId: savedShipment.id,
        status: ShipmentStatus.CREATED,
        changedBy: userId,
        changedAt: new Date(),
      });
      await queryRunner.manager.save(history);

      await queryRunner.commitTransaction();

      // Publish event (outside transaction)
      await this.eventPublisher.publishEvent(
        tenantId,
        ShipmentEventType.CREATED,
        savedShipment.id,
        {
          shipmentId: savedShipment.id,
          tenantId,
          status: savedShipment.status,
        }
      );

      return savedShipment;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async assignDriver(
    shipmentId: string,
    tenantId: string,
    assignDto: AssignDriverDto,
    userId: string
  ): Promise<Shipment> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Find shipment
      const shipment = await this.shipmentRepository.findById(shipmentId, tenantId);
      if (!shipment) {
        throw new AppError(ErrorCode.SHIPMENT_NOT_FOUND, 'Shipment not found', 404);
      }

      // Prevent reassignment if shipment is already ASSIGNED and not cancelled
      if (shipment.status === ShipmentStatus.ASSIGNED && shipment.driverId) {
        throw new AppError(
          ErrorCode.INVALID_SHIPMENT_STATE,
          'Cannot reassign driver to an already assigned shipment. Shipment must be cancelled first.',
          400
        );
      }

      // Validate state transition (now includes CANCEL_BY_DRIVER/CANCEL_BY_CUSTOMER → ASSIGNED)
      ShipmentStateMachine.validateTransition(shipment.status, ShipmentStatus.ASSIGNED);

      // Verify driver belongs to tenant
      const driverRepository = AppDataSource.getRepository(Driver);
      const driver = await driverRepository.findOne({
        where: { id: assignDto.driverId, tenantId, isActive: true },
      });

      if (!driver) {
        throw new AppError(ErrorCode.DRIVER_NOT_FOUND, 'Driver not found or inactive', 404);
      }

      // Store previous status to check if we're reassigning from cancelled
      const previousStatus = shipment.status;
      
      // Update shipment
      shipment.driverId = assignDto.driverId;
      shipment.status = ShipmentStatus.ASSIGNED;
      shipment.assignedAt = new Date();
      // Clear cancelledAt if reassigning from cancelled status
      if (previousStatus === ShipmentStatus.CANCEL_BY_DRIVER || 
          previousStatus === ShipmentStatus.CANCEL_BY_CUSTOMER) {
        shipment.cancelledAt = null;
      }
      
      const updatedShipment = await queryRunner.manager.save(shipment);

      // Create status history
      const history = await this.shipmentRepository.addStatusHistory({
        shipmentId: updatedShipment.id,
        status: ShipmentStatus.ASSIGNED,
        changedBy: userId,
        changedAt: new Date(),
        metadata: { 
          driverId: assignDto.driverId,
        },
      });
      await queryRunner.manager.save(history);

      await queryRunner.commitTransaction();

      // Publish event
      await this.eventPublisher.publishEvent(
        tenantId,
        ShipmentEventType.ASSIGNED,
        updatedShipment.id,
        {
          shipmentId: updatedShipment.id,
          tenantId,
          status: updatedShipment.status,
          previousStatus: shipment.status,
          driverId: assignDto.driverId,
        }
      );

      // Reload shipment with relations to ensure driver is included
      const shipmentWithRelations = await this.shipmentRepository.findById(
        updatedShipment.id,
        tenantId
      );

      if (!shipmentWithRelations) {
        throw new AppError(ErrorCode.SHIPMENT_NOT_FOUND, 'Shipment not found after update', 404);
      }

      return shipmentWithRelations;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async updateStatus(
    shipmentId: string,
    tenantId: string,
    updateDto: UpdateShipmentStatusDto,
    userId: string,
    userRole?: UserRole,
    driverId?: string
  ): Promise<Shipment> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Find shipment
      const shipment = await this.shipmentRepository.findById(shipmentId, tenantId);
      if (!shipment) {
        throw new AppError(ErrorCode.SHIPMENT_NOT_FOUND, 'Shipment not found', 404);
      }

      // If user is a driver, verify they are assigned to this shipment
      if (userRole === UserRole.DRIVER && driverId) {
        if (shipment.driverId !== driverId) {
          throw new AppError(
            ErrorCode.UNAUTHORIZED,
            'You can only update shipments assigned to you',
            403
          );
        }
        // Drivers can only update to: IN_TRANSIT, DELIVERED
        const allowedDriverStatuses = [
          ShipmentStatus.IN_TRANSIT,
          ShipmentStatus.DELIVERED,
        ];
        if (!allowedDriverStatuses.includes(updateDto.status)) {
          throw new AppError(
            ErrorCode.UNAUTHORIZED,
            'Drivers can only update status to: IN_TRANSIT or DELIVERED',
            403
          );
        }
      }

      // Validate state transition
      ShipmentStateMachine.validateTransition(shipment.status, updateDto.status);

      const previousStatus = shipment.status;
      shipment.status = updateDto.status;

      // Update timestamps based on status
      if (updateDto.status === ShipmentStatus.DELIVERED && !shipment.deliveredAt) {
        shipment.deliveredAt = new Date();
      }

      const updatedShipment = await queryRunner.manager.save(shipment);

      // Create status history
      const history = await this.shipmentRepository.addStatusHistory({
        shipmentId: updatedShipment.id,
        status: updateDto.status,
        changedBy: userId,
        changedAt: new Date(),
      });
      await queryRunner.manager.save(history);

      await queryRunner.commitTransaction();

      // Publish event
      const eventType = this.getEventTypeForStatus(updateDto.status);
      await this.eventPublisher.publishEvent(
        tenantId,
        eventType,
        updatedShipment.id,
        {
          shipmentId: updatedShipment.id,
          tenantId,
          status: updateDto.status,
          previousStatus,
        }
      );

      return updatedShipment;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getAllShipments(
    tenantId: string,
    status?: string,
    userRole?: UserRole,
    driverId?: string
  ): Promise<Shipment[]> {
    let shipments: Shipment[];

    // If user is a driver, only return their assigned shipments
    if (userRole === UserRole.DRIVER && driverId) {
      shipments = await this.shipmentRepository.findByDriver(tenantId, driverId);
    } else {
      // Admin can see all shipments
      shipments = await this.shipmentRepository.findByTenant(tenantId);
    }

    if (status) {
      return shipments.filter((s) => s.status === status);
    }
    return shipments;
  }

  async getShipmentById(
    shipmentId: string,
    tenantId: string,
    userRole?: UserRole,
    driverId?: string
  ): Promise<Shipment | null> {
    const shipment = await this.shipmentRepository.findById(shipmentId, tenantId);

    if (!shipment) {
      return null;
    }

    // If user is a driver, only allow access to their assigned shipments
    if (userRole === UserRole.DRIVER && driverId) {
      if (shipment.driverId !== driverId) {
        throw new AppError(
          ErrorCode.UNAUTHORIZED,
          'You can only view shipments assigned to you',
          403
        );
      }
    }

    return shipment;
  }

  async cancelByCustomer(
    shipmentId: string,
    tenantId: string,
    userId: string
  ): Promise<Shipment> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const shipment = await this.shipmentRepository.findById(shipmentId, tenantId);
      if (!shipment) {
        throw new AppError(ErrorCode.SHIPMENT_NOT_FOUND, 'Shipment not found', 404);
      }

      // Customer can only cancel before IN_TRANSIT
      if (shipment.status === ShipmentStatus.IN_TRANSIT || 
          shipment.status === ShipmentStatus.DELIVERED ||
          shipment.status === ShipmentStatus.CANCEL_BY_CUSTOMER ||
          shipment.status === ShipmentStatus.CANCEL_BY_DRIVER) {
        throw new AppError(
          ErrorCode.INVALID_SHIPMENT_STATE,
          'Cannot cancel shipment. Shipment is already in transit, delivered, or cancelled.',
          400
        );
      }

      // Validate state transition
      ShipmentStateMachine.validateTransition(shipment.status, ShipmentStatus.CANCEL_BY_CUSTOMER);

      const previousStatus = shipment.status;
      shipment.status = ShipmentStatus.CANCEL_BY_CUSTOMER;
      shipment.cancelledAt = new Date();

      const updatedShipment = await queryRunner.manager.save(shipment);

      // Create status history
      const history = await this.shipmentRepository.addStatusHistory({
        shipmentId: updatedShipment.id,
        status: ShipmentStatus.CANCEL_BY_CUSTOMER,
        changedBy: userId,
        changedAt: new Date(),
        metadata: { cancelledBy: 'customer' },
      });
      await queryRunner.manager.save(history);

      await queryRunner.commitTransaction();

      // Publish event
      await this.eventPublisher.publishEvent(
        tenantId,
        ShipmentEventType.STATUS_CHANGED,
        updatedShipment.id,
        {
          shipmentId: updatedShipment.id,
          tenantId,
          status: ShipmentStatus.CANCEL_BY_CUSTOMER,
          previousStatus,
        }
      );

      return updatedShipment;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async cancelByDriver(
    shipmentId: string,
    tenantId: string,
    userId: string,
    driverId: string
  ): Promise<Shipment> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const shipment = await this.shipmentRepository.findById(shipmentId, tenantId);
      if (!shipment) {
        throw new AppError(ErrorCode.SHIPMENT_NOT_FOUND, 'Shipment not found', 404);
      }

      // Verify driver is assigned to this shipment
      if (shipment.driverId !== driverId) {
        throw new AppError(
          ErrorCode.UNAUTHORIZED,
          'You can only cancel shipments assigned to you',
          403
        );
      }

      // Driver can only cancel before IN_TRANSIT
      if (shipment.status === ShipmentStatus.IN_TRANSIT || 
          shipment.status === ShipmentStatus.DELIVERED ||
          shipment.status === ShipmentStatus.CANCEL_BY_CUSTOMER ||
          shipment.status === ShipmentStatus.CANCEL_BY_DRIVER) {
        throw new AppError(
          ErrorCode.INVALID_SHIPMENT_STATE,
          'Cannot cancel shipment. Shipment is already in transit, delivered, or cancelled.',
          400
        );
      }

      // Validate state transition
      ShipmentStateMachine.validateTransition(shipment.status, ShipmentStatus.CANCEL_BY_DRIVER);

      const previousStatus = shipment.status;
      shipment.status = ShipmentStatus.CANCEL_BY_DRIVER;
      shipment.cancelledAt = new Date();
      shipment.driverId = null; // Remove driver assignment on cancellation

      const updatedShipment = await queryRunner.manager.save(shipment);

      // Create status history
      const history = await this.shipmentRepository.addStatusHistory({
        shipmentId: updatedShipment.id,
        status: ShipmentStatus.CANCEL_BY_DRIVER,
        changedBy: userId,
        changedAt: new Date(),
        metadata: { cancelledBy: 'driver', previousDriverId: driverId },
      });
      await queryRunner.manager.save(history);

      await queryRunner.commitTransaction();

      // Publish event
      await this.eventPublisher.publishEvent(
        tenantId,
        ShipmentEventType.STATUS_CHANGED,
        updatedShipment.id,
        {
          shipmentId: updatedShipment.id,
          tenantId,
          status: ShipmentStatus.CANCEL_BY_DRIVER,
          previousStatus,
        }
      );

      return updatedShipment;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private getEventTypeForStatus(status: ShipmentStatus): ShipmentEventType {
    const statusToEvent: Record<ShipmentStatus, ShipmentEventType> = {
      [ShipmentStatus.CREATED]: ShipmentEventType.CREATED,
      [ShipmentStatus.ASSIGNED]: ShipmentEventType.ASSIGNED,
      [ShipmentStatus.IN_TRANSIT]: ShipmentEventType.IN_TRANSIT,
      [ShipmentStatus.DELIVERED]: ShipmentEventType.DELIVERED,
      [ShipmentStatus.CANCEL_BY_CUSTOMER]: ShipmentEventType.STATUS_CHANGED,
      [ShipmentStatus.CANCEL_BY_DRIVER]: ShipmentEventType.STATUS_CHANGED,
    };
    return statusToEvent[status] || ShipmentEventType.STATUS_CHANGED;
  }
}

