import { IsEnum } from 'class-validator';

enum ShortLinkPreference {
  ASK = 'ASK',
  YES = 'YES',
  NO = 'NO',
}

export class ShortlinkPreferenceDto {
  @IsEnum(ShortLinkPreference)
  shortlink: ShortLinkPreference;
}

