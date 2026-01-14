import "reflect-metadata";
import { AppDataSource } from "../infra/db/data-source";
import { Shipment, ShipmentStatus } from "../infra/db/entities/Shipment";
import { ShipmentStatusHistory } from "../infra/db/entities/ShipmentStatusHistory";

async function cleanupOldShipments() {
  try {
    console.log("🔄 Connecting to database...");
    await AppDataSource.initialize();

    const shipmentRepository = AppDataSource.getRepository(Shipment);
    const statusHistoryRepository = AppDataSource.getRepository(ShipmentStatusHistory);

    // Find all shipments with legacy statuses (PICKED_UP or any status not in current enum)
    const validStatuses = [
      ShipmentStatus.CREATED,
      ShipmentStatus.ASSIGNED,
      ShipmentStatus.IN_TRANSIT,
      ShipmentStatus.DELIVERED,
      ShipmentStatus.CANCEL_BY_CUSTOMER,
      ShipmentStatus.CANCEL_BY_DRIVER,
    ];

    console.log("\n🔍 Finding shipments with legacy statuses...");
    
    // Get all shipments
    const allShipments = await shipmentRepository.find();
    
    // Filter shipments with invalid/legacy statuses
    const legacyShipments = allShipments.filter(
      (shipment) => !validStatuses.includes(shipment.status as ShipmentStatus)
    );

    if (legacyShipments.length === 0) {
      console.log("✅ No shipments with legacy statuses found!");
      await AppDataSource.destroy();
      process.exit(0);
    }

    console.log(`\n⚠️  Found ${legacyShipments.length} shipment(s) with legacy statuses:`);
    legacyShipments.forEach((shipment) => {
      console.log(`   - ID: ${shipment.id}, Status: ${shipment.status}, Customer: ${shipment.customerName}`);
    });

    console.log("\n🗑️  Deleting legacy shipments and their status history...");

    // Delete status history first (foreign key constraint)
    for (const shipment of legacyShipments) {
      await statusHistoryRepository.delete({ shipmentId: shipment.id });
      console.log(`   ✅ Deleted status history for shipment: ${shipment.id}`);
    }

    // Delete shipments
    const shipmentIds = legacyShipments.map((s) => s.id);
    const deleteResult = await shipmentRepository.delete(shipmentIds);
    
    console.log(`\n✅ Deleted ${deleteResult.affected || 0} shipment(s) with legacy statuses`);
    console.log("✅ Cleanup completed successfully!");

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    process.exit(1);
  }
}

cleanupOldShipments();

