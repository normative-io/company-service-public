export enum RequestType {
  InsertOrUpdate = 'insertOrUpdate',
  MarkDeleted = 'markDeleted',
}

// An incoming request for an insertOrUpdate or markDeleted operation.
// It includes the union of the fields required in those operations.
export class IncomingRequest {
  requestType: RequestType.InsertOrUpdate | RequestType.MarkDeleted;

  companyId?: string;

  country?: string;

  companyName?: string;

  isic?: string;

  created: Date;

  dataSource?: string;

  taxId?: string;

  orgNbr?: string;
}
