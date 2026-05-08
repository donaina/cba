import { IsInt, IsUUID, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class IssueChequeBookDto {
  @ApiProperty({ description: 'UUID of the current account' })
  @IsUUID()
  accountId: string;

  @ApiProperty({ example: 1, description: 'First cheque leaf number' })
  @IsInt()
  @Min(1)
  startLeaf: number;

  @ApiProperty({ example: 50, description: 'Last cheque leaf number' })
  @IsInt()
  @Min(1)
  endLeaf: number;
}
