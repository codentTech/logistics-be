import { Repository } from 'typeorm';
import { AppDataSource } from '../../../infra/db/data-source';
import { Shipment } from '../../../infra/db/entities/Shipment';
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
      where: { tenantId, driverId },
      relations: ['driver'],
      order: { createdAt: 'DESC' },
    });
  }
}

