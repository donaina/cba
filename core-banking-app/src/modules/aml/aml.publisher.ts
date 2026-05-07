import { Injectable, Logger } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';

@Injectable()
export class AmlPublisher {
  private readonly logger = new Logger(AmlPublisher.name);

  constructor(private readonly amqpConnection: AmqpConnection) {}

  async screenCustomer(customerId: string, tenantId: string, screeningType: string): Promise<void> {
    await this.amqpConnection.publish('cba.transactions', 'aml.screen.customer', {
      customerId,
      tenantId,
      screeningType,
    });
    this.logger.log(`Published aml.screen.customer for customer ${customerId}`);
  }

  async screenTransaction(
    transactionId: string,
    customerId: string,
    tenantId: string,
    amount: string,
  ): Promise<void> {
    await this.amqpConnection.publish('cba.transactions', 'aml.screen.transaction', {
      transactionId,
      customerId,
      tenantId,
      amount,
    });
    this.logger.log(`Published aml.screen.transaction for txn ${transactionId}`);
  }
}
