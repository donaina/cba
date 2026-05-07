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
import { NibssService } from './nibss.service';
import { NameEnquiryDto } from './dto/name-enquiry.dto';
import { InwardCreditDto } from './dto/inward-credit.dto';
import { RequirePermission, Public } from '@libs/common';

@Controller('nibss')
export class NibssController {
  private readonly logger = new Logger(NibssController.name);

  constructor(private readonly nibssService: NibssService) {}

  @Get('name-enquiry')
  @RequirePermission('txn:transfer')
  nameEnquiry(@Query() query: NameEnquiryDto) {
    return this.nibssService.nameEnquiry(query.accountNumber, query.bankCode);
  }

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
