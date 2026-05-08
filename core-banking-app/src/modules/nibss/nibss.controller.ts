import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Headers,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { NibssService } from './nibss.service';
import { NameEnquiryDto } from './dto/name-enquiry.dto';
import { InwardCreditDto } from './dto/inward-credit.dto';
import { RequirePermission, Public } from '@libs/common';

@ApiTags('NIBSS / NIP')
@Controller('nibss')
export class NibssController {
  private readonly logger = new Logger(NibssController.name);

  constructor(private readonly nibssService: NibssService) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: 'NIP name enquiry — resolve account holder name' })
  @ApiQuery({ name: 'accountNumber', description: '10-digit NUBAN account number' })
  @ApiQuery({ name: 'bankCode', description: '3-digit CBN bank code' })
  @ApiResponse({ status: 200, description: 'Account name returned from NIBSS' })
  @Get('name-enquiry')
  @RequirePermission('txn:transfer')
  nameEnquiry(@Query() query: NameEnquiryDto) {
    return this.nibssService.nameEnquiry(query.accountNumber, query.bankCode);
  }

  @ApiOperation({ summary: 'NIBSS inward credit webhook (called by NIBSS, not clients)' })
  @ApiHeader({ name: 'x-nibss-secret', required: true, description: 'NIBSS shared webhook secret' })
  @ApiResponse({ status: 201, description: 'Inward credit processed; customer account credited via NIBSS_SETTLEMENT' })
  @Post('inward-credit')
  @Public()
  inwardCredit(
    @Body() dto: InwardCreditDto,
    @Headers('x-nibss-secret') secret: string,
  ) {
    const expectedSecret = process.env.NIBSS_WEBHOOK_SECRET;
    if (!expectedSecret || secret !== expectedSecret) {
      throw new UnauthorizedException('Invalid NIBSS webhook secret');
    }
    return this.nibssService.processInwardCredit(dto);
  }
}
