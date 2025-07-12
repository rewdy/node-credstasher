export interface CredstashConfig {
  region?: string;
  kmsRegion?: string;
  table?: string;
  kmsKeyId?: string;
  profile?: string;
  dynamodbEndpoint?: string;
  kmsEndpoint?: string;
}

export interface CredstashItem {
  name: string;
  version: string;
  key: string;
  contents: string;
  created_at?: number;
  digest?: string;
  hmac: string;
}

export interface CredstashListItem {
  name: string;
  version: string;
}

export interface CredstashOptions {
  version?: string;
  context?: Record<string, string>;
  region?: string;
  table?: string;
  kmsKeyId?: string;
  profile?: string;
  endpoint?: string;
}

export interface CredstashPutOptions extends CredstashOptions {
  autoversion?: boolean;
  digest?: string;
}

export interface CredstashGetOptions extends CredstashOptions {
  noline?: boolean;
}

export interface CredstashDeleteOptions extends CredstashOptions {
  all?: boolean;
}

export interface CredstashListOptions extends CredstashOptions {
  // No additional options currently
}
