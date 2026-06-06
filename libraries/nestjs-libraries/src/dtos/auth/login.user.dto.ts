import {
  IsDefined,
  IsEmail,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

type Provider = 'LOCAL' | 'GITHUB' | 'GOOGLE' | 'FARCASTER' | 'WALLET' | 'GENERIC';

export class LoginUserDto {
  @IsString()
  @IsDefined()
  @ValidateIf((o) => !o.providerToken)
  @MinLength(3)
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
  email: string;

  datafast_visitor_id: string;
}
