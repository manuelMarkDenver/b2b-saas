import { CreateOrderDto } from './create-order.dto';

/**
 * Updating an order replaces its items entirely.
 * Shape is identical to creation — same SKU/quantity rules apply.
 * Only valid while the order is in PENDING status.
 */
export class UpdateOrderDto extends CreateOrderDto {}
