import {
  IsDefined,
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

type Provider = 'LOCAL' | 'GITHUB' | 'GOOGLE' | 'FARCASTER' | 'WALLET' | 'GENERIC';

export class CreateOrgUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  @IsDefined()
  @ValidateIf((o) => !o.providerToken)
  password: string;

  @IsString()
  @IsDefined()
  provider: Provider;

  @IsString()
  @IsDefined()
  @ValidateIf((o) => !o.password)
  providerToken: string;

  @IsEmail()
  @IsDefined()
  @ValidateIf((o) => !o.providerToken)
  email: string;

  @IsString()
  @IsDefined()
  @MinLength(3)
  @MaxLength(128)
  company: string;

  datafast_visitor_id: string;
}
