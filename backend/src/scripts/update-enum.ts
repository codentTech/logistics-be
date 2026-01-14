import 'reflect-metadata';
import { AppDataSource } from '../infra/db/data-source';

async function updateEnum() {
  try {
    console.log('🔄 Connecting to database...');
    await AppDataSource.initialize();

    const queryRunner = AppDataSource.createQueryRunner();
    
    console.log('🔄 Updating user_role_enum to add customer...');
    
    // Add 'customer' to the enum if it doesn't exist
    try {
      await queryRunner.query(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'customer' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role_enum')
          ) THEN
            ALTER TYPE "user_role_enum" ADD VALUE 'customer';
          END IF;
        END $$;
      `);
      console.log('✅ Added customer to enum');
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('ℹ️  customer already exists in enum');
      } else {
        throw error;
      }
    }
    
    // Note: We can't easily remove 'dispatcher' from enum in PostgreSQL
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

updateEnum();
