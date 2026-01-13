import { DataSource } from 'typeorm';
import { AppDataSource } from '../../../infra/db/data-source';
import { Shipment, ShipmentStatus } from '../../../infra/db/entities/Shipment';
import { ShipmentStatusHistory } from '../../../infra/db/entities/ShipmentStatusHistory';
import { Driver } from '../../../infra/db/entities/Driver';
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

      // Validate state transition only if not already ASSIGNED
      // Allow reassigning driver to an already ASSIGNED shipment
      if (shipment.status !== ShipmentStatus.ASSIGNED) {
        ShipmentStateMachine.validateTransition(shipment.status, ShipmentStatus.ASSIGNED);
      }

      // Verify driver belongs to tenant
      const driverRepository = AppDataSource.getRepository(Driver);
      const driver = await driverRepository.findOne({
        where: { id: assignDto.driverId, tenantId, isActive: true },
      });

      if (!driver) {
        throw new AppError(ErrorCode.DRIVER_NOT_FOUND, 'Driver not found or inactive', 404);
      }

      // Check if this is a status change or just driver reassignment
      const isStatusChange = shipment.status !== ShipmentStatus.ASSIGNED;
      const previousDriverId = shipment.driverId;
      const isDriverChange = previousDriverId !== assignDto.driverId;

      // Update shipment
      shipment.driverId = assignDto.driverId;
      
      // Only update status and assignedAt if status is changing
      if (isStatusChange) {
        shipment.status = ShipmentStatus.ASSIGNED;
        shipment.assignedAt = new Date();
      }
      
      const updatedShipment = await queryRunner.manager.save(shipment);

      // Create status history only if status changed or driver changed
      if (isStatusChange || isDriverChange) {
        const history = await this.shipmentRepository.addStatusHistory({
          shipmentId: updatedShipment.id,
          status: ShipmentStatus.ASSIGNED,
          changedBy: userId,
          changedAt: new Date(),
          metadata: { 
            driverId: assignDto.driverId,
            previousDriverId: previousDriverId,
            isReassignment: !isStatusChange && isDriverChange,
          },
        });
        await queryRunner.manager.save(history);
      }

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

      // Validate state transition
      ShipmentStateMachine.validateTransition(shipment.status, updateDto.status);

      const previousStatus = shipment.status;
      shipment.status = updateDto.status;

      // Update timestamps based on status
      if (updateDto.status === ShipmentStatus.PICKED_UP && !shipment.pickedUpAt) {
        shipment.pickedUpAt = new Date();
      }
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

  async getAllShipments(tenantId: string, status?: string): Promise<Shipment[]> {
    const shipments = await this.shipmentRepository.findByTenant(tenantId);
    if (status) {
      return shipments.filter((s) => s.status === status);
    }
    return shipments;
  }

  async getShipmentById(shipmentId: string, tenantId: string): Promise<Shipment | null> {
    return this.shipmentRepository.findById(shipmentId, tenantId);
  }

  private getEventTypeForStatus(status: ShipmentStatus): ShipmentEventType {
    const statusToEvent: Record<ShipmentStatus, ShipmentEventType> = {
      [ShipmentStatus.CREATED]: ShipmentEventType.CREATED,
      [ShipmentStatus.ASSIGNED]: ShipmentEventType.ASSIGNED,
      [ShipmentStatus.PICKED_UP]: ShipmentEventType.PICKED_UP,
      [ShipmentStatus.IN_TRANSIT]: ShipmentEventType.IN_TRANSIT,
      [ShipmentStatus.DELIVERED]: ShipmentEventType.DELIVERED,
    };
    return statusToEvent[status] || ShipmentEventType.STATUS_CHANGED;
  }
}

