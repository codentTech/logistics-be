import "reflect-metadata";
import { AppDataSource } from "../infra/db/data-source";
import { Tenant } from "../infra/db/entities/Tenant";
import { User, UserRole } from "../infra/db/entities/User";
import { Driver } from "../infra/db/entities/Driver";
import bcrypt from "bcrypt";

async function seed() {
  try {
    await AppDataSource.initialize();
    console.log("✅ Database connected");

    const tenantRepository = AppDataSource.getRepository(Tenant);
    const userRepository = AppDataSource.getRepository(User);
    const driverRepository = AppDataSource.getRepository(Driver);

    // Create tenant
    let tenant = await tenantRepository.findOne({
      where: { slug: "tenant-1" },
    });
    if (!tenant) {
      tenant = tenantRepository.create({
        name: "Demo Tenant",
        slug: "tenant-1",
        isActive: true,
      });
      tenant = await tenantRepository.save(tenant);
      console.log("✅ Created tenant:", tenant.id);
    }

    // Create admin user
    const passwordHash = await bcrypt.hash("password123", 10);
    let adminUser = await userRepository.findOne({
      where: { email: "admin@tenant1.com", tenantId: tenant.id },
    });
    if (!adminUser) {
      adminUser = userRepository.create({
        tenantId: tenant.id,
        email: "admin@tenant1.com",
        passwordHash,
        role: UserRole.OPS_ADMIN,
        firstName: "Admin",
        lastName: "User",
        isActive: true,
      });
      adminUser = await userRepository.save(adminUser);
      console.log("✅ Created admin user:", adminUser.email);
    }

    // Create driver
    let driver = await driverRepository.findOne({
      where: { tenantId: tenant.id, name: "John Driver" },
    });
    if (!driver) {
      driver = driverRepository.create({
        tenantId: tenant.id,
        userId: adminUser.id,
        name: "John Driver",
        phone: "+1234567890",
        licenseNumber: "DL123456",
        isActive: true,
      });
      driver = await driverRepository.save(driver);
      console.log("✅ Created driver:", driver.id);
    }

    console.log("\n✅ Seed data created successfully!");
    console.log("\n" + "=".repeat(60));
    console.log("📋 TEST CREDENTIALS & IDs");
    console.log("=".repeat(60));
    console.log("\n🔐 Login Credentials:");
    console.log("   Email: admin@tenant1.com");
    console.log("   Password: password123");
    console.log("   Tenant ID:", tenant.id);
    console.log("\n🚗 Driver ID:", driver.id);
    console.log("\n💡 Copy these IDs for API testing!");
    console.log("=".repeat(60));

    await AppDataSource.destroy();
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

seed();
