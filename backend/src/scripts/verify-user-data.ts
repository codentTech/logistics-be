import "reflect-metadata";
import { AppDataSource } from "../infra/db/data-source";
import { User } from "../infra/db/entities/User";

async function verifyUserData() {
  try {
    console.log("🔄 Connecting to database...");
    await AppDataSource.initialize();

    const userRepository = AppDataSource.getRepository(User);

    console.log("\n🔍 Checking driver5@acme.com...");
    const user = await userRepository.findOne({
      where: {
        email: "driver5@acme.com",
        isActive: true,
      },
    });

    if (!user) {
      console.log("❌ User not found!");
      await AppDataSource.destroy();
      process.exit(1);
    }

    console.log("\n✅ User found:");
    console.log("   ID:", user.id);
    console.log("   Email:", user.email);
    console.log("   Role:", user.role);
    console.log("   First Name:", user.firstName);
    console.log("   Last Name:", user.lastName);
    console.log("   Full Name:", `${user.firstName || ""} ${user.lastName || ""}`.trim() || "N/A");
    console.log("   Tenant ID:", user.tenantId);
    console.log("   Is Active:", user.isActive);

    // Also check raw database query
    console.log("\n🔍 Raw database query result:");
    const rawResult = await AppDataSource.query(
      `SELECT id, email, role, "firstName", "lastName", "tenantId", "isActive" FROM users WHERE email = $1 AND "isActive" = $2`,
      ["driver5@acme.com", true]
    );
    console.log(JSON.stringify(rawResult[0], null, 2));

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  }
}

verifyUserData();

