export interface CommandOptions {
  region?: string;
  table?: string;
  kmsKeyId?: string;
  profile?: string;
  dynamodbEndpoint?: string;
  kmsEndpoint?: string;
}

export interface PutCommandOptions {
  keyVersion?: string;
  context?: string;
  autoversion?: boolean;
}

export interface GetCommandOptions {
  keyVersion?: string;
  context?: string;
  noline?: boolean;
}

export interface DeleteCommandOptions {
  keyVersion?: string;
  all?: boolean;
}
