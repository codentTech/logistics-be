import { Repository, Not, In } from 'typeorm';
import { AppDataSource } from '../../../infra/db/data-source';
import { Shipment, ShipmentStatus } from '../../../infra/db/entities/Shipment';
import { ShipmentStatusHistory } from '../../../infra/db/entities/ShipmentStatusHistory';

export class ShipmentRepository {
  private shipmentRepository: Repository<Shipment>;
  private statusHistoryRepository: Repository<ShipmentStatusHistory>;

  constructor() {
    this.shipmentRepository = AppDataSource.getRepository(Shipment);
    this.statusHistoryRepository = AppDataSource.getRepository(ShipmentStatusHistory);
  }

  async findById(id: string, tenantId: string): Promise<Shipment | null> {
    return this.shipmentRepository.findOne({
      where: { id, tenantId },
      relations: ['driver', 'tenant'],
    });
  }

  async create(shipment: Partial<Shipment>): Promise<Shipment> {
    const newShipment = this.shipmentRepository.create(shipment);
    return this.shipmentRepository.save(newShipment);
  }

  async update(id: string, tenantId: string, updates: Partial<Shipment>): Promise<Shipment> {
    await this.shipmentRepository.update({ id, tenantId }, updates);
    const updated = await this.findById(id, tenantId);
    if (!updated) {
      throw new Error('Shipment not found after update');
    }
    return updated;
  }

  async addStatusHistory(history: Partial<ShipmentStatusHistory>): Promise<ShipmentStatusHistory> {
    const newHistory = this.statusHistoryRepository.create(history);
    return this.statusHistoryRepository.save(newHistory);
  }

  async findByTenant(tenantId: string): Promise<Shipment[]> {
    return this.shipmentRepository.find({
      where: { tenantId },
      relations: ['driver'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByDriver(tenantId: string, driverId: string): Promise<Shipment[]> {
    return this.shipmentRepository.find({
      where: { 
        tenantId, 
        driverId,
        // Exclude cancelled shipments - drivers should not see shipments they or customers cancelled
        // When a shipment is cancelled, it reverts to CREATED status but driverId is cleared
        // So we only show shipments that are not cancelled (status is not CANCEL_BY_DRIVER or CANCEL_BY_CUSTOMER)
        status: Not(In([ShipmentStatus.CANCEL_BY_DRIVER, ShipmentStatus.CANCEL_BY_CUSTOMER]))
      },
      relations: ['driver'],
      order: { createdAt: 'DESC' },
    });
  }
}

