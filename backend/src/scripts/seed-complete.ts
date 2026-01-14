import "reflect-metadata";
import { AppDataSource } from "../infra/db/data-source";
import { Tenant } from "../infra/db/entities/Tenant";
import { User, UserRole } from "../infra/db/entities/User";
import { Driver } from "../infra/db/entities/Driver";
import { Shipment, ShipmentStatus } from "../infra/db/entities/Shipment";
import { ShipmentStatusHistory } from "../infra/db/entities/ShipmentStatusHistory";
import bcrypt from "bcrypt";

async function seedComplete() {
  try {
    await AppDataSource.initialize();
    console.log("✅ Database connected");

    const tenantRepository = AppDataSource.getRepository(Tenant);
    const userRepository = AppDataSource.getRepository(User);
    const driverRepository = AppDataSource.getRepository(Driver);
    const shipmentRepository = AppDataSource.getRepository(Shipment);
    const statusHistoryRepository = AppDataSource.getRepository(ShipmentStatusHistory);

    const passwordHash = await bcrypt.hash("password123", 10);

    // ============================================
    // TENANT 1: Acme Logistics
    // ============================================
    console.log("\n📦 Creating Tenant 1: Acme Logistics...");
    let tenant1 = await tenantRepository.findOne({
      where: { slug: "acme-logistics" },
    });
    if (!tenant1) {
      tenant1 = tenantRepository.create({
        name: "Acme Logistics",
        slug: "acme-logistics",
        isActive: true,
      });
      tenant1 = await tenantRepository.save(tenant1);
      console.log("✅ Created tenant:", tenant1.name);
    }

    // Admin User for Tenant 1
    let admin1 = await userRepository.findOne({
      where: { email: "admin@acme.com", tenantId: tenant1.id },
    });
    if (!admin1) {
      admin1 = userRepository.create({
        tenantId: tenant1.id,
        email: "admin@acme.com",
        passwordHash,
        role: UserRole.OPS_ADMIN,
        firstName: "John",
        lastName: "Admin",
        isActive: true,
      });
      admin1 = await userRepository.save(admin1);
      console.log("✅ Created admin:", admin1.email);
    }

    // Customer Users for Tenant 1
    const customer1Emails = [
      "customer1@acme.com",
      "customer2@acme.com",
      "customer3@acme.com",
    ];
    const customers1: User[] = [];
    for (const email of customer1Emails) {
      let customer = await userRepository.findOne({
        where: { email, tenantId: tenant1.id },
      });
      if (!customer) {
        customer = userRepository.create({
          tenantId: tenant1.id,
          email,
          passwordHash,
          role: UserRole.CUSTOMER,
          firstName: `Customer${customer1Emails.indexOf(email) + 1}`,
          lastName: "User",
          isActive: true,
        });
        customer = await userRepository.save(customer);
        customers1.push(customer);
        console.log(`✅ Created customer: ${email}`);
      } else {
        customers1.push(customer);
      }
    }

    // Drivers for Tenant 1
    const drivers1Data = [
      { name: "Mike Driver", phone: "+1234567890", license: "DL001", email: "driver1@acme.com" },
      { name: "Sarah Driver", phone: "+1234567891", license: "DL002", email: "driver2@acme.com" },
      { name: "Tom Driver", phone: "+1234567892", license: "DL003", email: "driver3@acme.com" },
      { name: "Emma Driver", phone: "+1234567893", license: "DL004", email: "driver4@acme.com" },
      { name: "Alex Driver", phone: "+1234567894", license: "DL005", email: "driver5@acme.com" },
    ];
    const drivers1: Driver[] = [];
    for (const driverData of drivers1Data) {
      // Create user for driver
      let driverUser = await userRepository.findOne({
        where: { email: driverData.email, tenantId: tenant1.id },
      });
      if (!driverUser) {
        driverUser = userRepository.create({
          tenantId: tenant1.id,
          email: driverData.email,
          passwordHash,
          role: UserRole.DRIVER,
          firstName: driverData.name.split(" ")[0],
          lastName: driverData.name.split(" ")[1],
          isActive: true,
        });
        driverUser = await userRepository.save(driverUser);
      }

      // Create driver entity
      let driver = await driverRepository.findOne({
        where: { tenantId: tenant1.id, name: driverData.name },
      });
      if (!driver) {
        driver = driverRepository.create({
          tenantId: tenant1.id,
          userId: driverUser.id,
          name: driverData.name,
          phone: driverData.phone,
          licenseNumber: driverData.license,
          isActive: true,
        });
        driver = await driverRepository.save(driver);
        drivers1.push(driver);
        console.log(`✅ Created driver: ${driverData.name}`);
      } else {
        drivers1.push(driver);
      }
    }

    // Shipments for Tenant 1
    // Clean up old shipments with legacy statuses first
    console.log("\n🧹 Cleaning up old shipments with legacy statuses...");
    const allOldShipments = await shipmentRepository.find({
      where: { tenantId: tenant1.id },
    });
    
    // Delete status history first
    for (const shipment of allOldShipments) {
      await statusHistoryRepository.delete({ shipmentId: shipment.id });
    }
    
    // Delete all old shipments
    await shipmentRepository.delete({ tenantId: tenant1.id });
    console.log(`✅ Cleaned up ${allOldShipments.length} old shipment(s)`);

    // Create new shipments with CREATED status only
    const shipments1Data = [
      {
        customerName: "Alice Johnson",
        customerPhone: "+1987654321",
        pickupAddress: "123 Main St, New York, NY 10001",
        deliveryAddress: "456 Oak Ave, Brooklyn, NY 11201",
        status: ShipmentStatus.CREATED,
      },
      {
        customerName: "Bob Smith",
        customerPhone: "+1987654322",
        pickupAddress: "789 Pine Rd, Manhattan, NY 10002",
        deliveryAddress: "321 Elm St, Queens, NY 11101",
        status: ShipmentStatus.CREATED,
      },
      {
        customerName: "Charlie Brown",
        customerPhone: "+1987654323",
        pickupAddress: "555 Broadway, New York, NY 10003",
        deliveryAddress: "777 Park Ave, Bronx, NY 10451",
        status: ShipmentStatus.CREATED,
      },
      {
        customerName: "Diana Prince",
        customerPhone: "+1987654324",
        pickupAddress: "888 5th Ave, New York, NY 10004",
        deliveryAddress: "999 Madison Ave, New York, NY 10005",
        status: ShipmentStatus.CREATED,
      },
      {
        customerName: "Edward Norton",
        customerPhone: "+1987654325",
        pickupAddress: "111 Wall St, New York, NY 10006",
        deliveryAddress: "222 Water St, New York, NY 10007",
        status: ShipmentStatus.CREATED,
      },
      {
        customerName: "Fiona Apple",
        customerPhone: "+1987654326",
        pickupAddress: "333 Canal St, New York, NY 10008",
        deliveryAddress: "444 Houston St, New York, NY 10009",
        status: ShipmentStatus.CREATED,
      },
      {
        customerName: "George Clooney",
        customerPhone: "+1987654327",
        pickupAddress: "666 Lexington Ave, New York, NY 10010",
        deliveryAddress: "888 3rd Ave, New York, NY 10011",
        status: ShipmentStatus.CREATED,
      },
      {
        customerName: "Helen Mirren",
        customerPhone: "+1987654328",
        pickupAddress: "999 6th Ave, New York, NY 10012",
        deliveryAddress: "111 7th Ave, New York, NY 10013",
        status: ShipmentStatus.CREATED,
      },
      {
        customerName: "Ian McKellen",
        customerPhone: "+1987654329",
        pickupAddress: "222 8th Ave, New York, NY 10014",
        deliveryAddress: "333 9th Ave, New York, NY 10015",
        status: ShipmentStatus.CREATED,
      },
      {
        customerName: "Julia Roberts",
        customerPhone: "+1987654330",
        pickupAddress: "444 10th Ave, New York, NY 10016",
        deliveryAddress: "555 11th Ave, New York, NY 10017",
        status: ShipmentStatus.CREATED,
      },
    ];

    for (const shipmentData of shipments1Data) {
      let shipment = await shipmentRepository.findOne({
        where: {
          tenantId: tenant1.id,
          customerPhone: shipmentData.customerPhone,
        },
      });

      if (!shipment) {
        shipment = shipmentRepository.create({
          tenantId: tenant1.id,
          customerName: shipmentData.customerName,
          customerPhone: shipmentData.customerPhone,
          pickupAddress: shipmentData.pickupAddress,
          deliveryAddress: shipmentData.deliveryAddress,
          status: ShipmentStatus.CREATED, // All shipments start with CREATED status
          driverId: null, // No driver assigned initially
          assignedAt: null,
          cancelledAt: null,
          deliveredAt: null,
        });
        shipment = await shipmentRepository.save(shipment);

        // Create status history
        const history = statusHistoryRepository.create({
          shipmentId: shipment.id,
          status: shipment.status,
          changedBy: admin1.id,
          changedAt: new Date(),
        });
        await statusHistoryRepository.save(history);

        console.log(`✅ Created shipment: ${shipmentData.customerName} (${shipmentData.status})`);
      }
    }

    // ============================================
    // TENANT 2: Global Shipping
    // ============================================
    console.log("\n📦 Creating Tenant 2: Global Shipping...");
    let tenant2 = await tenantRepository.findOne({
      where: { slug: "global-shipping" },
    });
    if (!tenant2) {
      tenant2 = tenantRepository.create({
        name: "Global Shipping Co",
        slug: "global-shipping",
        isActive: true,
      });
      tenant2 = await tenantRepository.save(tenant2);
      console.log("✅ Created tenant:", tenant2.name);
    }

    // Admin User for Tenant 2
    let admin2 = await userRepository.findOne({
      where: { email: "admin@global.com", tenantId: tenant2.id },
    });
    if (!admin2) {
      admin2 = userRepository.create({
        tenantId: tenant2.id,
        email: "admin@global.com",
        passwordHash,
        role: UserRole.OPS_ADMIN,
        firstName: "Jane",
        lastName: "Admin",
        isActive: true,
      });
      admin2 = await userRepository.save(admin2);
      console.log("✅ Created admin:", admin2.email);
    }

    // Customer Users for Tenant 2
    const customer2Emails = [
      "customer1@global.com",
      "customer2@global.com",
    ];
    const customers2: User[] = [];
    for (const email of customer2Emails) {
      let customer = await userRepository.findOne({
        where: { email, tenantId: tenant2.id },
      });
      if (!customer) {
        customer = userRepository.create({
          tenantId: tenant2.id,
          email,
          passwordHash,
          role: UserRole.CUSTOMER,
          firstName: `Customer${customer2Emails.indexOf(email) + 1}`,
          lastName: "User",
          isActive: true,
        });
        customer = await userRepository.save(customer);
        customers2.push(customer);
        console.log(`✅ Created customer: ${email}`);
      } else {
        customers2.push(customer);
      }
    }

    // Drivers for Tenant 2
    const drivers2Data = [
      { name: "Lisa Driver", phone: "+1987654401", license: "DL101", email: "driver1@global.com" },
      { name: "Mark Driver", phone: "+1987654402", license: "DL102", email: "driver2@global.com" },
      { name: "Nancy Driver", phone: "+1987654403", license: "DL103", email: "driver3@global.com" },
    ];
    const drivers2: Driver[] = [];
    for (const driverData of drivers2Data) {
      // Create user for driver
      let driverUser = await userRepository.findOne({
        where: { email: driverData.email, tenantId: tenant2.id },
      });
      if (!driverUser) {
        driverUser = userRepository.create({
          tenantId: tenant2.id,
          email: driverData.email,
          passwordHash,
          role: UserRole.DRIVER,
          firstName: driverData.name.split(" ")[0],
          lastName: driverData.name.split(" ")[1],
          isActive: true,
        });
        driverUser = await userRepository.save(driverUser);
      }

      // Create driver entity
      let driver = await driverRepository.findOne({
        where: { tenantId: tenant2.id, name: driverData.name },
      });
      if (!driver) {
        driver = driverRepository.create({
          tenantId: tenant2.id,
          userId: driverUser.id,
          name: driverData.name,
          phone: driverData.phone,
          licenseNumber: driverData.license,
          isActive: true,
        });
        driver = await driverRepository.save(driver);
        drivers2.push(driver);
        console.log(`✅ Created driver: ${driverData.name}`);
      } else {
        drivers2.push(driver);
      }
    }

    // Clean up old shipments for Tenant 2
    console.log("\n🧹 Cleaning up old shipments for Tenant 2...");
    const allOldShipments2 = await shipmentRepository.find({
      where: { tenantId: tenant2.id },
    });
    
    // Delete status history first
    for (const shipment of allOldShipments2) {
      await statusHistoryRepository.delete({ shipmentId: shipment.id });
    }
    
    // Delete all old shipments
    await shipmentRepository.delete({ tenantId: tenant2.id });
    console.log(`✅ Cleaned up ${allOldShipments2.length} old shipment(s) for Tenant 2`);

    // Create new shipments with CREATED status only
    const shipments2Data = [
      {
        customerName: "Oliver Twist",
        customerPhone: "+1987654501",
        pickupAddress: "100 First St, Los Angeles, CA 90001",
        deliveryAddress: "200 Second St, Los Angeles, CA 90002",
        status: ShipmentStatus.CREATED,
      },
      {
        customerName: "Patricia Highsmith",
        customerPhone: "+1987654502",
        pickupAddress: "300 Third St, Los Angeles, CA 90003",
        deliveryAddress: "400 Fourth St, Los Angeles, CA 90004",
        status: ShipmentStatus.CREATED,
      },
      {
        customerName: "Quentin Tarantino",
        customerPhone: "+1987654503",
        pickupAddress: "500 Fifth St, Los Angeles, CA 90005",
        deliveryAddress: "600 Sixth St, Los Angeles, CA 90006",
        status: ShipmentStatus.CREATED,
      },
      {
        customerName: "Rachel Green",
        customerPhone: "+1987654504",
        pickupAddress: "700 Seventh St, Los Angeles, CA 90007",
        deliveryAddress: "800 Eighth St, Los Angeles, CA 90008",
        status: ShipmentStatus.CREATED,
      },
      {
        customerName: "Steve Jobs",
        customerPhone: "+1987654505",
        pickupAddress: "900 Ninth St, Los Angeles, CA 90009",
        deliveryAddress: "1000 Tenth St, Los Angeles, CA 90010",
        status: ShipmentStatus.CREATED,
      },
      {
        customerName: "Tina Fey",
        customerPhone: "+1987654506",
        pickupAddress: "1100 Eleventh St, Los Angeles, CA 90011",
        deliveryAddress: "1200 Twelfth St, Los Angeles, CA 90012",
        status: ShipmentStatus.CREATED,
      },
    ];

    for (const shipmentData of shipments2Data) {
      let shipment = await shipmentRepository.findOne({
        where: {
          tenantId: tenant2.id,
          customerPhone: shipmentData.customerPhone,
        },
      });

      if (!shipment) {
        shipment = shipmentRepository.create({
          tenantId: tenant2.id,
          customerName: shipmentData.customerName,
          customerPhone: shipmentData.customerPhone,
          pickupAddress: shipmentData.pickupAddress,
          deliveryAddress: shipmentData.deliveryAddress,
          status: ShipmentStatus.CREATED, // All shipments start with CREATED status
          driverId: null, // No driver assigned initially
          assignedAt: null,
          cancelledAt: null,
          deliveredAt: null,
        });
        shipment = await shipmentRepository.save(shipment);

        // Create status history
        const history = statusHistoryRepository.create({
          shipmentId: shipment.id,
          status: shipment.status,
          changedBy: admin2.id,
          changedAt: new Date(),
        });
        await statusHistoryRepository.save(history);

        console.log(`✅ Created shipment: ${shipmentData.customerName} (${shipmentData.status})`);
      }
    }

    // ============================================
    // SUMMARY
    // ============================================
    console.log("\n" + "=".repeat(70));
    console.log("✅ COMPLETE SEED DATA CREATED SUCCESSFULLY!");
    console.log("=".repeat(70));

    console.log("\n📋 TENANT 1: Acme Logistics (slug: acme-logistics)");
    console.log("   👤 Admin: admin@acme.com / password123");
    console.log("   👥 Customers:");
    customer1Emails.forEach((email) => console.log(`      - ${email} / password123`));
    console.log("   🚗 Drivers:");
    drivers1Data.forEach((d, i) => console.log(`      - ${d.email} / password123 (${d.name})`));
    console.log("   📦 Shipments: 10 (all with CREATED status)");

    console.log("\n📋 TENANT 2: Global Shipping Co (slug: global-shipping)");
    console.log("   👤 Admin: admin@global.com / password123");
    console.log("   👥 Customers:");
    customer2Emails.forEach((email) => console.log(`      - ${email} / password123`));
    console.log("   🚗 Drivers:");
    drivers2Data.forEach((d, i) => console.log(`      - ${d.email} / password123 (${d.name})`));
    console.log("   📦 Shipments: 6 (all with CREATED status)");

    console.log("\n💡 All users use password: password123");
    console.log("💡 Use tenant slugs for login (no tenant ID needed)");
    console.log("=".repeat(70));

    await AppDataSource.destroy();
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

seedComplete();

