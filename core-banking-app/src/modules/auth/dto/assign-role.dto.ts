import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignRoleDto {
  @ApiProperty({ example: 'uuid-role-id' })
  @IsString()
  @IsNotEmpty()
  roleId: string;
}
