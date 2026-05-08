import { PartialType } from '@nestjs/swagger';
import { CreateGlAccountDto } from './create-gl-account.dto';

export class UpdateGlAccountDto extends PartialType(CreateGlAccountDto) {}
