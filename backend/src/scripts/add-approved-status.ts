import 'reflect-metadata';
import { AppDataSource } from '../infra/db/data-source';

async function addApprovedStatus() {
  try {
    console.log('🔄 Connecting to database...');
    await AppDataSource.initialize();

    const queryRunner = AppDataSource.createQueryRunner();

    try {
      console.log('🔄 Adding APPROVED to shipment_status_enum...');
      
      // Check if APPROVED already exists
      const existingValues = await queryRunner.query(`
        SELECT enumlabel 
        FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'shipment_status_enum')
        AND enumlabel = 'APPROVED';
      `);

      if (existingValues.length > 0) {
        console.log('✅ APPROVED status already exists in enum');
      } else {
        await queryRunner.query(`
          ALTER TYPE "shipment_status_enum" ADD VALUE 'APPROVED';
        `);
        console.log('✅ Added APPROVED to shipment_status_enum');
      }

      // Add pendingApproval column if it doesn't exist
      const pendingApprovalColumn = await queryRunner.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'shipments' 
        AND column_name = 'pendingApproval';
      `);

      if (pendingApprovalColumn.length === 0) {
        await queryRunner.query(`
          ALTER TABLE "shipments" 
          ADD COLUMN "pendingApproval" BOOLEAN NOT NULL DEFAULT false;
        `);
        console.log('✅ Added pendingApproval column to shipments table');
      } else {
        console.log('✅ pendingApproval column already exists');
      }

      // Add approvedAt column if it doesn't exist
      const approvedAtColumn = await queryRunner.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'shipments' 
        AND column_name = 'approvedAt';
      `);

      if (approvedAtColumn.length === 0) {
        await queryRunner.query(`
          ALTER TABLE "shipments" 
          ADD COLUMN "approvedAt" TIMESTAMP;
        `);
        console.log('✅ Added approvedAt column to shipments table');
      } else {
        console.log('✅ approvedAt column already exists');
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
    console.error('❌ Error updating database:', error);
    process.exit(1);
  }
}

addApprovedStatus();

