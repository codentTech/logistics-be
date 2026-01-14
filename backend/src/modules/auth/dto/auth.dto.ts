import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
} from "class-validator";

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsUUID()
  @IsOptional()
  tenantId?: string; // Optional - only required if email exists in multiple tenants
}

export class TenantOption {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export class TenantSelectionResponse {
  success: boolean;
  requiresTenantSelection: boolean;
  tenants: TenantOption[];
  message: string;
}

export class LoginResponseDto {
  success: boolean;
  token?: string; // Optional if tenant selection required
  user?: {
    id: string;
    email: string;
    role: string;
    tenantId: string;
    firstName?: string;
    lastName?: string;
  };
  requiresTenantSelection?: boolean;
  tenants?: TenantOption[];
  message?: string;
}
