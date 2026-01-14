import 'reflect-metadata';
import { AppDataSource } from '../infra/db/data-source';

async function updateShipmentEnum() {
  try {
    console.log('🔄 Connecting to database...');
    await AppDataSource.initialize();

    const queryRunner = AppDataSource.createQueryRunner();
    
    console.log('🔄 Updating shipment_status_enum...');
    
    // Add new enum values
    try {
      await queryRunner.query(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'CANCEL_BY_CUSTOMER' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'shipment_status_enum')
          ) THEN
            ALTER TYPE "shipment_status_enum" ADD VALUE 'CANCEL_BY_CUSTOMER';
          END IF;
        END $$;
      `);
      console.log('✅ Added CANCEL_BY_CUSTOMER to enum');
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('ℹ️  CANCEL_BY_CUSTOMER already exists in enum');
      } else {
        throw error;
      }
    }

    try {
      await queryRunner.query(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'CANCEL_BY_DRIVER' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'shipment_status_enum')
          ) THEN
            ALTER TYPE "shipment_status_enum" ADD VALUE 'CANCEL_BY_DRIVER';
          END IF;
        END $$;
      `);
      console.log('✅ Added CANCEL_BY_DRIVER to enum');
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('ℹ️  CANCEL_BY_DRIVER already exists in enum');
      } else {
        throw error;
      }
    }
    
    // Note: We can't easily remove PICKED_UP from enum in PostgreSQL
    // It will remain but won't be used. In production, you'd need a migration strategy.
    
    console.log('✅ Enum update completed!');
    
    await queryRunner.release();
    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Enum update failed:', error);
    process.exit(1);
  }
}

updateShipmentEnum();

