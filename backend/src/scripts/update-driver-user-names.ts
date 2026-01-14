import "reflect-metadata";
import { AppDataSource } from "../infra/db/data-source";
import { User, UserRole } from "../infra/db/entities/User";
import { Driver } from "../infra/db/entities/Driver";

async function updateDriverUserNames() {
  try {
    console.log("🔄 Connecting to database...");
    await AppDataSource.initialize();

    const userRepository = AppDataSource.getRepository(User);
    const driverRepository = AppDataSource.getRepository(Driver);

    console.log("\n🔍 Finding all driver users...");
    const driverUsers = await userRepository.find({
      where: {
        role: UserRole.DRIVER,
        isActive: true,
      },
    });

    if (driverUsers.length === 0) {
      console.log("✅ No driver users found!");
      await AppDataSource.destroy();
      process.exit(0);
    }

    console.log(`\n📦 Found ${driverUsers.length} driver user(s)`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const driverUser of driverUsers) {
      // Find the associated Driver entity
      const driver = await driverRepository.findOne({
        where: {
          userId: driverUser.id,
          tenantId: driverUser.tenantId,
        },
      });

      if (!driver || !driver.name) {
        console.log(
          `   ⚠️  Skipped ${driverUser.email} - No driver entity or name found`
        );
        skippedCount++;
        continue;
      }

      // Parse driver name (e.g., "Alex Driver" -> firstName: "Alex", lastName: "Driver")
      const nameParts = driver.name.trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      // Only update if firstName/lastName are missing or different
      if (
        driverUser.firstName !== firstName ||
        driverUser.lastName !== lastName
      ) {
        const oldFirstName = driverUser.firstName || "null";
        const oldLastName = driverUser.lastName || "null";

        driverUser.firstName = firstName;
        driverUser.lastName = lastName;

        await userRepository.save(driverUser);

        console.log(
          `   ✅ Updated ${driverUser.email}: "${oldFirstName} ${oldLastName}" → "${firstName} ${lastName}"`
        );
        updatedCount++;
      } else {
        console.log(
          `   ℹ️  Skipped ${driverUser.email} - Already has correct name`
        );
        skippedCount++;
      }
    }

    console.log(`\n✅ Update completed!`);
    console.log(`   - Updated: ${updatedCount} user(s)`);
    console.log(`   - Skipped: ${skippedCount} user(s)`);

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error("❌ Update failed:", error);
    process.exit(1);
  }
}

updateDriverUserNames();

