import 'reflect-metadata';
import { AppDataSource } from '../infra/db/data-source';

async function addCancelledAtColumn() {
  try {
    console.log('🔄 Connecting to database...');
    await AppDataSource.initialize();

    const queryRunner = AppDataSource.createQueryRunner();
    
    console.log('🔄 Adding cancelledAt column if it doesn\'t exist...');
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'shipments' AND column_name = 'cancelledAt'
        ) THEN
          ALTER TABLE shipments ADD COLUMN "cancelledAt" TIMESTAMP NULL;
          RAISE NOTICE 'Column cancelledAt added successfully';
        ELSE
          RAISE NOTICE 'Column cancelledAt already exists';
        END IF;
      END $$;
    `);
    
    await queryRunner.release();
    console.log('✅ cancelledAt column check completed');
    
    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding column:', error);
    process.exit(1);
  }
}

addCancelledAtColumn();

