import { IsInt, IsUUID, Min } from 'class-validator';

export class IssueChequeBookDto {
  @IsUUID()
  accountId: string;

  @IsInt()
  @Min(1)
  startLeaf: number;

  @IsInt()
  @Min(1)
  endLeaf: number;
}
