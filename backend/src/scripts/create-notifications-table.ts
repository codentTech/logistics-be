import 'reflect-metadata';
import { AppDataSource } from '../infra/db/data-source';

async function createNotificationsTable() {
  try {
    console.log('🔄 Connecting to database...');
    await AppDataSource.initialize();

    const queryRunner = AppDataSource.createQueryRunner();

    try {
      // Check if notifications table exists
      const tableExists = await queryRunner.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications';
      `);

      if (tableExists.length > 0) {
        console.log('✅ Notifications table already exists');
      } else {
        console.log('🔄 Creating notifications table...');
        
        // Create notification_type_enum if it doesn't exist
        await queryRunner.query(`
          DO $$ BEGIN
            CREATE TYPE "public"."notification_type_enum" AS ENUM('SHIPMENT_ASSIGNED', 'SHIPMENT_APPROVED', 'SHIPMENT_REJECTED', 'SHIPMENT_CANCELLED', 'SHIPMENT_IN_TRANSIT', 'SHIPMENT_DELIVERED');
          EXCEPTION
            WHEN duplicate_object THEN null;
          END $$;
        `);

        // Create notification_status_enum if it doesn't exist
        await queryRunner.query(`
          DO $$ BEGIN
            CREATE TYPE "public"."notification_status_enum" AS ENUM('UNREAD', 'READ');
          EXCEPTION
            WHEN duplicate_object THEN null;
          END $$;
        `);

        // Create notifications table
        await queryRunner.query(`
          CREATE TABLE "notifications" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "userId" uuid NOT NULL,
            "shipmentId" uuid,
            "type" "notification_type_enum" NOT NULL,
            "title" varchar(255) NOT NULL,
            "message" text NOT NULL,
            "status" "notification_status_enum" NOT NULL DEFAULT 'UNREAD',
            "metadata" jsonb,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_notifications" PRIMARY KEY ("id")
          );
        `);

        // Create indexes
        await queryRunner.query(`
          CREATE INDEX "IDX_notifications_userId" ON "notifications" ("userId");
        `);
        await queryRunner.query(`
          CREATE INDEX "IDX_notifications_shipmentId" ON "notifications" ("shipmentId");
        `);
        await queryRunner.query(`
          CREATE INDEX "IDX_notifications_status" ON "notifications" ("status");
        `);
        await queryRunner.query(`
          CREATE INDEX "IDX_notifications_createdAt" ON "notifications" ("createdAt");
        `);

        // Add foreign key constraints
        await queryRunner.query(`
          ALTER TABLE "notifications" 
          ADD CONSTRAINT "FK_notifications_userId" 
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
        `);
        await queryRunner.query(`
          ALTER TABLE "notifications" 
          ADD CONSTRAINT "FK_notifications_shipmentId" 
          FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE;
        `);

        console.log('✅ Notifications table created successfully');
      }

      await queryRunner.release();
      console.log('✅ Database schema updated successfully!');
    } catch (error: any) {
      await queryRunner.release();
      throw error;
    }

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating notifications table:', error);
    process.exit(1);
  }
}

createNotificationsTable();

