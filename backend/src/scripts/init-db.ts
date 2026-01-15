import 'reflect-metadata';
import { AppDataSource } from '../infra/db/data-source';

async function initDatabase() {
  try {
    console.log('🔄 Connecting to database...');
    await AppDataSource.initialize();

    // Try to create enum types manually first (requires CREATE privilege)
    // If this fails, TypeORM will try to create them during synchronize
    console.log('🔄 Creating enum types (if needed)...');
    const queryRunner = AppDataSource.createQueryRunner();
    
    try {
      await queryRunner.query(`
        DO $$ BEGIN
          CREATE TYPE "public"."user_role_enum" AS ENUM('ops_admin', 'driver', 'customer');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);
      
      await queryRunner.query(`
        DO $$ BEGIN
          CREATE TYPE "public"."shipment_status_enum" AS ENUM('CREATED', 'ASSIGNED', 'APPROVED', 'IN_TRANSIT', 'DELIVERED', 'CANCEL_BY_CUSTOMER', 'CANCEL_BY_DRIVER');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);
      
      await queryRunner.query(`
        DO $$ BEGIN
          CREATE TYPE "public"."notification_type_enum" AS ENUM('SHIPMENT_ASSIGNED', 'SHIPMENT_APPROVED', 'SHIPMENT_REJECTED', 'SHIPMENT_CANCELLED', 'SHIPMENT_IN_TRANSIT', 'SHIPMENT_DELIVERED');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);
      
      await queryRunner.query(`
        DO $$ BEGIN
          CREATE TYPE "public"."notification_status_enum" AS ENUM('UNREAD', 'READ');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);
      
      await queryRunner.query(`
        DO $$ BEGIN
          CREATE TYPE "public"."event_outbox_status_enum" AS ENUM('PENDING', 'PROCESSED', 'FAILED', 'DEAD_LETTER');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);
      console.log('✅ Enum types created/verified');
    } catch (enumError: any) {
      if (enumError?.code === '42501') {
        console.log('⚠️  Permission denied for enum creation - TypeORM will handle it');
      } else {
        throw enumError;
      }
    }
    
    await queryRunner.release();

    console.log('🔄 Synchronizing database schema...');
    await AppDataSource.synchronize();

    console.log('✅ Database initialized successfully!');
    console.log('📊 Tables created:');
    const tables = await AppDataSource.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    tables.forEach((table: any) => {
      console.log(`   - ${table.table_name}`);
    });

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  }
}

initDatabase();

