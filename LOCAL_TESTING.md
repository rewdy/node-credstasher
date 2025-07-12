# Local Testing Setup for node-credstasher

This document explains how to set up and use the local KMS and DynamoDB services for testing your credstash implementation.

## Prerequisites

- Docker and Docker Compose installed
- AWS CLI installed (for testing connectivity)
- Node.js/Bun installed

## Services

### Local KMS

- **Image**: `nsmithuk/local-kms`
- **Port**: 4599
- **Purpose**: Provides a local KMS service for encryption/decryption operations

### Local DynamoDB

- **Image**: `amazon/dynamodb-local`
- **Port**: 8000
- **Purpose**: Provides a local DynamoDB service for credential storage

## Quick Start

1. **Start the services:**

   ```bash
   bun run local:start
   ```

2. **Run the tests:**

   ```bash
   bun run test
   ```

3. **Stop the services:**
   ```bash
   bun run local:stop
   ```

## Environment Variables

The following environment variables are configured in `.env.local`:

```bash
# Local development environment variables
# Source this file or add these to your shell profile for testing

# AWS Configuration for local testing
export AWS_ACCESS_KEY_ID=dummyaccess
export AWS_SECRET_ACCESS_KEY=dummysecret
export AWS_REGION=us-east-1

# Credstash Configuration
export CREDSTASH_ENDPOINT=http://localhost:4599
export CREDSTASH_TABLE=credential-store-test-cli
export CREDSTASH_KMS_KEY_ID=alias/credstash

# DynamoDB Configuration
export DYNAMODB_ENDPOINT=http://localhost:8000
export KMS_ENDPOINT=http://localhost:4599
```

## KMS Key Setup

The local KMS service is pre-configured with:

- **Key ID**: `credstash-test-key`
- **Key Alias**: `alias/credstash`
- **Key Type**: AES 256-bit symmetric key

## Manual Testing

### Test KMS Connection

```bash
source .env.local
aws kms list-keys --endpoint-url http://localhost:4599 --region us-east-1
```

### Test DynamoDB Connection

```bash
source .env.local
aws dynamodb list-tables --endpoint-url http://localhost:8000 --region us-east-1
```

### Test Credstash Operations

```bash
# Source environment variables
source .env.local

# Run your credstash commands
bun run cli -- setup  # Create the credential table
bun run cli -- put mykey "my secret value"
bun run cli -- get mykey
bun run cli -- list
```

## Using in Your Code

When testing your credstash implementation, configure the client with local endpoints:

```typescript
import { CredstashClient } from "./src/lib/credstash.js";

const client = new CredstashClient({
  endpoint: "http://localhost:4599",
  region: "us-east-1",
  table: "credential-store",
  kmsKeyId: "alias/credstash",
});
```

## Troubleshooting

### Services not starting

- Check if ports 4599 and 8000 are available
- Run `docker-compose logs` to see error messages

### KMS errors

- Ensure the KMS service is fully started (check health with `curl http://localhost:4599/`)
- Verify the key alias exists: `aws kms list-aliases --endpoint-url http://localhost:4599`

### DynamoDB errors

- Ensure the DynamoDB service is running: `aws dynamodb list-tables --endpoint-url http://localhost:8000`
- Create the table if it doesn't exist: `bun run cli -- setup`

## Available Scripts

- `bun run local:start` - Start Docker services
- `bun run local:stop` - Stop Docker services
- `bun run test:cli` - Run cli tests
- `bun run test:lib` - Run library tests
