import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { RequirePermission } from '@libs/common';
import { AmlService } from './aml.service';
import { FreezeAccountDto } from './dto/freeze-account.dto';
import { FileStrDto } from './dto/file-str.dto';

@ApiTags('Compliance / AML')
@ApiBearerAuth()
@Controller('compliance')
export class AmlController {
  constructor(private readonly amlService: AmlService) {}

  @ApiOperation({ summary: 'Freeze an account (compliance hold)' })
  @ApiParam({ name: 'accountId', description: 'Account UUID' })
  @ApiResponse({ status: 200, description: 'Account frozen; no debits or credits permitted' })
  @Patch('freeze/:accountId')
  @RequirePermission('aml:freeze')
  freezeAccount(@Param('accountId') accountId: string, @Body() dto: FreezeAccountDto) {
    return this.amlService.freezeAccount({ ...dto, accountId });
  }

  @ApiOperation({ summary: 'Lift a compliance freeze on an account' })
  @ApiParam({ name: 'accountId', description: 'Account UUID' })
  @Patch('unfreeze/:accountId')
  @RequirePermission('aml:freeze')
  unfreezeAccount(
    @Param('accountId') accountId: string,
    @Body() body: { note: string },
  ) {
    return this.amlService.unfreezeAccount(accountId, body.note);
  }

  @ApiOperation({ summary: 'List AML alerts' })
  @ApiQuery({ name: 'resolved', required: false, type: Boolean, description: 'Filter by resolved status' })
  @Get('alerts')
  @RequirePermission('aml:str')
  listAlerts(@Query('resolved') resolved?: string) {
    return this.amlService.listAlerts(resolved === 'true');
  }

  @ApiOperation({ summary: 'Resolve an AML alert' })
  @ApiParam({ name: 'id', description: 'Alert UUID' })
  @Patch('alerts/:id/resolve')
  @RequirePermission('aml:freeze')
  resolveAlert(
    @Param('id') id: string,
    @Body() body: { note: string },
  ) {
    return this.amlService.resolveAlert(id, body.note);
  }

  @ApiOperation({ summary: 'File a Suspicious Transaction Report (STR) with the CBN' })
  @ApiResponse({ status: 201, description: 'STR created in DRAFT status' })
  @Post('str')
  @RequirePermission('aml:str')
  fileStr(@Body() dto: FileStrDto) {
    return this.amlService.fileStr(dto);
  }

  @ApiOperation({ summary: 'Submit a drafted STR to the regulator' })
  @ApiParam({ name: 'id', description: 'STR UUID' })
  @Patch('str/:id/submit')
  @RequirePermission('aml:str')
  submitStr(@Param('id') id: string) {
    return this.amlService.submitStr(id);
  }

  @ApiOperation({ summary: 'List all Suspicious Transaction Reports' })
  @Get('str')
  @RequirePermission('aml:str')
  listStrs() {
    return this.amlService.listStrs();
  }
}
