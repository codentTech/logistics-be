import "reflect-metadata";
import { AppDataSource } from "../infra/db/data-source";
import { Shipment, ShipmentStatus } from "../infra/db/entities/Shipment";

async function resetShipmentsToCreated() {
  try {
    console.log("🔄 Connecting to database...");
    await AppDataSource.initialize();

    const shipmentRepository = AppDataSource.getRepository(Shipment);

    console.log("\n🔍 Finding all shipments...");
    const allShipments = await shipmentRepository.find();

    if (allShipments.length === 0) {
      console.log("✅ No shipments found!");
      await AppDataSource.destroy();
      process.exit(0);
    }

    console.log(`\n📦 Found ${allShipments.length} shipment(s)`);
    
    // Count shipments that need updating
    const shipmentsToUpdate = allShipments.filter(
      (shipment) =>
        shipment.status !== ShipmentStatus.CREATED || shipment.driverId !== null
    );

    if (shipmentsToUpdate.length === 0) {
      console.log("✅ All shipments are already in CREATED status with no driver assigned!");
      await AppDataSource.destroy();
      process.exit(0);
    }

    console.log(`\n🔄 Updating ${shipmentsToUpdate.length} shipment(s)...`);

    // Update all shipments to CREATED status and remove driver assignments
    for (const shipment of shipmentsToUpdate) {
      const oldStatus = shipment.status;
      const oldDriverId = shipment.driverId;

      shipment.status = ShipmentStatus.CREATED;
      shipment.driverId = null;
      shipment.assignedAt = null;
      shipment.deliveredAt = null;
      shipment.cancelledAt = null;

      await shipmentRepository.save(shipment);

      console.log(
        `   ✅ Updated shipment ${shipment.id.substring(0, 8)}... (${oldStatus} → CREATED, driver: ${oldDriverId ? "removed" : "none"})`
      );
    }

    console.log(`\n✅ Successfully updated ${shipmentsToUpdate.length} shipment(s)!`);
    console.log("   - All shipments are now in CREATED status");
    console.log("   - All driver assignments have been removed");

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error("❌ Reset failed:", error);
    process.exit(1);
  }
}

resetShipmentsToCreated();

