import { Entity, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { BaseEntity } from "./BaseEntity";
import { Tenant } from "./Tenant";

export enum UserRole {
  OPS_ADMIN = "ops_admin",
  DRIVER = "driver",
  CUSTOMER = "customer",
}

@Entity("users")
@Index(["email", "tenantId"], { unique: true })
export class User extends BaseEntity {
  @Column({ type: "uuid" })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: "CASCADE" })
  @JoinColumn({ name: "tenantId" })
  tenant: Tenant;

  @Column({ type: "varchar", length: 255 })
  @Index()
  email: string;

  @Column({ type: "varchar", length: 255 })
  passwordHash: string;

  @Column({
    type: "enum",
    enum: UserRole,
    enumName: "user_role_enum",
    default: UserRole.DRIVER,
  })
  role: UserRole;

  @Column({ type: "varchar", length: 255, nullable: true })
  firstName: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  lastName: string;

  @Column({ type: "boolean", default: true })
  isActive: boolean;
}
