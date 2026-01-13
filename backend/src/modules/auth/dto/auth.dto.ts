import { IsEmail, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsUUID()
  @IsNotEmpty()
  tenantId: string;
}

export class LoginResponseDto {
  success: boolean;
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
    tenantId: string;
  };
}

