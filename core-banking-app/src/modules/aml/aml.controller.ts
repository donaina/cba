import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { RequirePermission } from '@libs/common';
import { AmlService } from './aml.service';
import { FreezeAccountDto } from './dto/freeze-account.dto';
import { FileStrDto } from './dto/file-str.dto';

@Controller('compliance')
export class AmlController {
  constructor(private readonly amlService: AmlService) {}

  @Patch('freeze/:accountId')
  @RequirePermission('aml:freeze')
  freezeAccount(@Param('accountId') accountId: string, @Body() dto: FreezeAccountDto) {
    return this.amlService.freezeAccount({ ...dto, accountId });
  }

  @Patch('unfreeze/:accountId')
  @RequirePermission('aml:freeze')
  unfreezeAccount(
    @Param('accountId') accountId: string,
    @Body() body: { note: string },
  ) {
    return this.amlService.unfreezeAccount(accountId, body.note);
  }

  @Get('alerts')
  @RequirePermission('aml:str')
  listAlerts(@Query('resolved') resolved?: string) {
    return this.amlService.listAlerts(resolved === 'true');
  }

  @Patch('alerts/:id/resolve')
  @RequirePermission('aml:freeze')
  resolveAlert(
    @Param('id') id: string,
    @Body() body: { note: string },
  ) {
    return this.amlService.resolveAlert(id, body.note);
  }

  @Post('str')
  @RequirePermission('aml:str')
  fileStr(@Body() dto: FileStrDto) {
    return this.amlService.fileStr(dto);
  }

  @Patch('str/:id/submit')
  @RequirePermission('aml:str')
  submitStr(@Param('id') id: string) {
    return this.amlService.submitStr(id);
  }

  @Get('str')
  @RequirePermission('aml:str')
  listStrs() {
    return this.amlService.listStrs();
  }
}
