import "reflect-metadata";
import { AppDataSource } from "../infra/db/data-source";
import { Tenant } from "../infra/db/entities/Tenant";
import { User, UserRole } from "../infra/db/entities/User";
import { Driver } from "../infra/db/entities/Driver";
import { Shipment, ShipmentStatus } from "../infra/db/entities/Shipment";
import { ShipmentStatusHistory } from "../infra/db/entities/ShipmentStatusHistory";
import bcrypt from "bcrypt";

async function cleanAndReseed() {
  try {
    console.log("🔄 Connecting to database...");
    await AppDataSource.initialize();

    const tenantRepository = AppDataSource.getRepository(Tenant);
    const userRepository = AppDataSource.getRepository(User);
    const driverRepository = AppDataSource.getRepository(Driver);
    const shipmentRepository = AppDataSource.getRepository(Shipment);
    const statusHistoryRepository = AppDataSource.getRepository(ShipmentStatusHistory);

    console.log("\n🗑️  Cleaning up all existing data...");

    // Delete in correct order (respecting foreign keys)
    console.log("   - Deleting shipment status history...");
    await statusHistoryRepository.createQueryBuilder().delete().execute();

    console.log("   - Deleting shipments...");
    await shipmentRepository.createQueryBuilder().delete().execute();

    console.log("   - Deleting drivers...");
    await driverRepository.createQueryBuilder().delete().execute();

    console.log("   - Deleting users...");
    await userRepository.createQueryBuilder().delete().execute();

    console.log("   - Deleting tenants...");
    await tenantRepository.createQueryBuilder().delete().execute();

    console.log("✅ All data cleaned up!\n");

    const passwordHash = await bcrypt.hash("password123", 10);

    // ============================================
    // TENANT 1: Acme Logistics
    // ============================================
    console.log("📦 Creating Tenant 1: Acme Logistics...");
    const tenant1 = tenantRepository.create({
      name: "Acme Logistics",
      slug: "acme-logistics",
      isActive: true,
    });
    const savedTenant1 = await tenantRepository.save(tenant1);
    console.log("✅ Created tenant:", savedTenant1.name);

    // Admin User for Tenant 1
    const admin1 = userRepository.create({
      tenantId: savedTenant1.id,
      email: "admin@acme.com",
      passwordHash,
      role: UserRole.OPS_ADMIN,
      firstName: "John",
      lastName: "Admin",
      isActive: true,
    });
    const savedAdmin1 = await userRepository.save(admin1);
    console.log("✅ Created admin:", savedAdmin1.email, `(${savedAdmin1.firstName} ${savedAdmin1.lastName})`);

    // Customer Users for Tenant 1
    const customer1Emails = [
      { email: "customer1@acme.com", firstName: "Alice", lastName: "Customer" },
      { email: "customer2@acme.com", firstName: "Bob", lastName: "Customer" },
      { email: "customer3@acme.com", firstName: "Charlie", lastName: "Customer" },
    ];
    const customers1: User[] = [];
    for (const customerData of customer1Emails) {
      const customer = userRepository.create({
        tenantId: savedTenant1.id,
        email: customerData.email,
        passwordHash,
        role: UserRole.CUSTOMER,
        firstName: customerData.firstName,
        lastName: customerData.lastName,
        isActive: true,
      });
      const savedCustomer = await userRepository.save(customer);
      customers1.push(savedCustomer);
      console.log(`✅ Created customer: ${savedCustomer.email} (${savedCustomer.firstName} ${savedCustomer.lastName})`);
    }

    // Drivers for Tenant 1
    const drivers1Data = [
      { name: "Mike Driver", phone: "+1234567890", license: "DL001", email: "driver1@acme.com", firstName: "Mike", lastName: "Driver" },
      { name: "Sarah Driver", phone: "+1234567891", license: "DL002", email: "driver2@acme.com", firstName: "Sarah", lastName: "Driver" },
      { name: "Tom Driver", phone: "+1234567892", license: "DL003", email: "driver3@acme.com", firstName: "Tom", lastName: "Driver" },
      { name: "Emma Driver", phone: "+1234567893", license: "DL004", email: "driver4@acme.com", firstName: "Emma", lastName: "Driver" },
      { name: "Alex Driver", phone: "+1234567894", license: "DL005", email: "driver5@acme.com", firstName: "Alex", lastName: "Driver" },
    ];
    const drivers1: Driver[] = [];
    for (const driverData of drivers1Data) {
      // Create user for driver
      const driverUser = userRepository.create({
        tenantId: savedTenant1.id,
        email: driverData.email,
        passwordHash,
        role: UserRole.DRIVER,
        firstName: driverData.firstName,
        lastName: driverData.lastName,
        isActive: true,
      });
      const savedDriverUser = await userRepository.save(driverUser);
      console.log(`✅ Created driver user: ${savedDriverUser.email} (${savedDriverUser.firstName} ${savedDriverUser.lastName})`);

      // Create driver entity
      const driver = driverRepository.create({
        tenantId: savedTenant1.id,
        userId: savedDriverUser.id,
        name: driverData.name,
        phone: driverData.phone,
        licenseNumber: driverData.license,
        isActive: true,
      });
      const savedDriver = await driverRepository.save(driver);
      drivers1.push(savedDriver);
      console.log(`✅ Created driver: ${driverData.name}`);
    }

    // Shipments for Tenant 1 (all CREATED status, no driver assigned)
    const shipments1Data = [
      {
        customerName: "Alice Johnson",
        customerPhone: "+1987654321",
        pickupAddress: "123 Main St, New York, NY 10001",
        deliveryAddress: "456 Oak Ave, Brooklyn, NY 11201",
      },
      {
        customerName: "Bob Smith",
        customerPhone: "+1987654322",
        pickupAddress: "789 Pine Rd, Manhattan, NY 10002",
        deliveryAddress: "321 Elm St, Queens, NY 11101",
      },
      {
        customerName: "Charlie Brown",
        customerPhone: "+1987654323",
        pickupAddress: "555 Broadway, New York, NY 10003",
        deliveryAddress: "777 Park Ave, Bronx, NY 10451",
      },
      {
        customerName: "Diana Prince",
        customerPhone: "+1987654324",
        pickupAddress: "888 5th Ave, New York, NY 10004",
        deliveryAddress: "999 Madison Ave, New York, NY 10005",
      },
      {
        customerName: "Edward Norton",
        customerPhone: "+1987654325",
        pickupAddress: "111 Wall St, New York, NY 10006",
        deliveryAddress: "222 Water St, New York, NY 10007",
      },
      {
        customerName: "Fiona Apple",
        customerPhone: "+1987654326",
        pickupAddress: "333 Canal St, New York, NY 10008",
        deliveryAddress: "444 Houston St, New York, NY 10009",
      },
      {
        customerName: "George Clooney",
        customerPhone: "+1987654327",
        pickupAddress: "666 Lexington Ave, New York, NY 10010",
        deliveryAddress: "888 3rd Ave, New York, NY 10011",
      },
      {
        customerName: "Helen Mirren",
        customerPhone: "+1987654328",
        pickupAddress: "999 6th Ave, New York, NY 10012",
        deliveryAddress: "111 7th Ave, New York, NY 10013",
      },
      {
        customerName: "Ian McKellen",
        customerPhone: "+1987654329",
        pickupAddress: "222 8th Ave, New York, NY 10014",
        deliveryAddress: "333 9th Ave, New York, NY 10015",
      },
      {
        customerName: "Julia Roberts",
        customerPhone: "+1987654330",
        pickupAddress: "444 10th Ave, New York, NY 10016",
        deliveryAddress: "555 11th Ave, New York, NY 10017",
      },
    ];

    for (const shipmentData of shipments1Data) {
      const shipment = shipmentRepository.create({
        tenantId: savedTenant1.id,
        customerName: shipmentData.customerName,
        customerPhone: shipmentData.customerPhone,
        pickupAddress: shipmentData.pickupAddress,
        deliveryAddress: shipmentData.deliveryAddress,
        status: ShipmentStatus.CREATED,
        driverId: null,
        assignedAt: null,
        cancelledAt: null,
        deliveredAt: null,
      });
      const savedShipment = await shipmentRepository.save(shipment);

      // Create status history
      const history = statusHistoryRepository.create({
        shipmentId: savedShipment.id,
        status: ShipmentStatus.CREATED,
        changedBy: savedAdmin1.id,
        changedAt: new Date(),
      });
      await statusHistoryRepository.save(history);

      console.log(`✅ Created shipment: ${shipmentData.customerName} (CREATED)`);
    }

    // ============================================
    // TENANT 2: Global Shipping
    // ============================================
    console.log("\n📦 Creating Tenant 2: Global Shipping...");
    const tenant2 = tenantRepository.create({
      name: "Global Shipping Co",
      slug: "global-shipping",
      isActive: true,
    });
    const savedTenant2 = await tenantRepository.save(tenant2);
    console.log("✅ Created tenant:", savedTenant2.name);

    // Admin User for Tenant 2
    const admin2 = userRepository.create({
      tenantId: savedTenant2.id,
      email: "admin@global.com",
      passwordHash,
      role: UserRole.OPS_ADMIN,
      firstName: "Jane",
      lastName: "Admin",
      isActive: true,
    });
    const savedAdmin2 = await userRepository.save(admin2);
    console.log("✅ Created admin:", savedAdmin2.email, `(${savedAdmin2.firstName} ${savedAdmin2.lastName})`);

    // Customer Users for Tenant 2
    const customer2Emails = [
      { email: "customer1@global.com", firstName: "Oliver", lastName: "Customer" },
      { email: "customer2@global.com", firstName: "Patricia", lastName: "Customer" },
    ];
    const customers2: User[] = [];
    for (const customerData of customer2Emails) {
      const customer = userRepository.create({
        tenantId: savedTenant2.id,
        email: customerData.email,
        passwordHash,
        role: UserRole.CUSTOMER,
        firstName: customerData.firstName,
        lastName: customerData.lastName,
        isActive: true,
      });
      const savedCustomer = await userRepository.save(customer);
      customers2.push(savedCustomer);
      console.log(`✅ Created customer: ${savedCustomer.email} (${savedCustomer.firstName} ${savedCustomer.lastName})`);
    }

    // Drivers for Tenant 2
    const drivers2Data = [
      { name: "Lisa Driver", phone: "+1987654401", license: "DL101", email: "driver1@global.com", firstName: "Lisa", lastName: "Driver" },
      { name: "Mark Driver", phone: "+1987654402", license: "DL102", email: "driver2@global.com", firstName: "Mark", lastName: "Driver" },
      { name: "Nancy Driver", phone: "+1987654403", license: "DL103", email: "driver3@global.com", firstName: "Nancy", lastName: "Driver" },
    ];
    const drivers2: Driver[] = [];
    for (const driverData of drivers2Data) {
      // Create user for driver
      const driverUser = userRepository.create({
        tenantId: savedTenant2.id,
        email: driverData.email,
        passwordHash,
        role: UserRole.DRIVER,
        firstName: driverData.firstName,
        lastName: driverData.lastName,
        isActive: true,
      });
      const savedDriverUser = await userRepository.save(driverUser);
      console.log(`✅ Created driver user: ${savedDriverUser.email} (${savedDriverUser.firstName} ${savedDriverUser.lastName})`);

      // Create driver entity
      const driver = driverRepository.create({
        tenantId: savedTenant2.id,
        userId: savedDriverUser.id,
        name: driverData.name,
        phone: driverData.phone,
        licenseNumber: driverData.license,
        isActive: true,
      });
      const savedDriver = await driverRepository.save(driver);
      drivers2.push(savedDriver);
      console.log(`✅ Created driver: ${driverData.name}`);
    }

    // Shipments for Tenant 2 (all CREATED status, no driver assigned)
    const shipments2Data = [
      {
        customerName: "Oliver Twist",
        customerPhone: "+1987654501",
        pickupAddress: "100 First St, Los Angeles, CA 90001",
        deliveryAddress: "200 Second St, Los Angeles, CA 90002",
      },
      {
        customerName: "Patricia Highsmith",
        customerPhone: "+1987654502",
        pickupAddress: "300 Third St, Los Angeles, CA 90003",
        deliveryAddress: "400 Fourth St, Los Angeles, CA 90004",
      },
      {
        customerName: "Quentin Tarantino",
        customerPhone: "+1987654503",
        pickupAddress: "500 Fifth St, Los Angeles, CA 90005",
        deliveryAddress: "600 Sixth St, Los Angeles, CA 90006",
      },
      {
        customerName: "Rachel Green",
        customerPhone: "+1987654504",
        pickupAddress: "700 Seventh St, Los Angeles, CA 90007",
        deliveryAddress: "800 Eighth St, Los Angeles, CA 90008",
      },
      {
        customerName: "Steve Jobs",
        customerPhone: "+1987654505",
        pickupAddress: "900 Ninth St, Los Angeles, CA 90009",
        deliveryAddress: "1000 Tenth St, Los Angeles, CA 90010",
      },
      {
        customerName: "Tina Fey",
        customerPhone: "+1987654506",
        pickupAddress: "1100 Eleventh St, Los Angeles, CA 90011",
        deliveryAddress: "1200 Twelfth St, Los Angeles, CA 90012",
      },
    ];

    for (const shipmentData of shipments2Data) {
      const shipment = shipmentRepository.create({
        tenantId: savedTenant2.id,
        customerName: shipmentData.customerName,
        customerPhone: shipmentData.customerPhone,
        pickupAddress: shipmentData.pickupAddress,
        deliveryAddress: shipmentData.deliveryAddress,
        status: ShipmentStatus.CREATED,
        driverId: null,
        assignedAt: null,
        cancelledAt: null,
        deliveredAt: null,
      });
      const savedShipment = await shipmentRepository.save(shipment);

      // Create status history
      const history = statusHistoryRepository.create({
        shipmentId: savedShipment.id,
        status: ShipmentStatus.CREATED,
        changedBy: savedAdmin2.id,
        changedAt: new Date(),
      });
      await statusHistoryRepository.save(history);

      console.log(`✅ Created shipment: ${shipmentData.customerName} (CREATED)`);
    }

    // ============================================
    // SUMMARY
    // ============================================
    console.log("\n" + "=".repeat(70));
    console.log("✅ DATABASE CLEANED AND RESEEDED SUCCESSFULLY!");
    console.log("=".repeat(70));

    console.log("\n📋 TENANT 1: Acme Logistics (slug: acme-logistics)");
    console.log("   👤 Admin: admin@acme.com / password123 (John Admin)");
    console.log("   👥 Customers:");
    customer1Emails.forEach((c) => console.log(`      - ${c.email} / password123 (${c.firstName} ${c.lastName})`));
    console.log("   🚗 Drivers:");
    drivers1Data.forEach((d) => console.log(`      - ${d.email} / password123 (${d.firstName} ${d.lastName})`));
    console.log("   📦 Shipments: 10 (all CREATED status)");

    console.log("\n📋 TENANT 2: Global Shipping Co (slug: global-shipping)");
    console.log("   👤 Admin: admin@global.com / password123 (Jane Admin)");
    console.log("   👥 Customers:");
    customer2Emails.forEach((c) => console.log(`      - ${c.email} / password123 (${c.firstName} ${c.lastName})`));
    console.log("   🚗 Drivers:");
    drivers2Data.forEach((d) => console.log(`      - ${d.email} / password123 (${d.firstName} ${d.lastName})`));
    console.log("   📦 Shipments: 6 (all CREATED status)");

    console.log("\n💡 All users use password: password123");
    console.log("💡 All users have firstName and lastName properly set");
    console.log("=".repeat(70));

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error("❌ Clean and reseed failed:", error);
    process.exit(1);
  }
}

cleanAndReseed();

