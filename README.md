# node-credstasher

A TypeScript implementation of the python [credstash](https://pypi.org/project/credstash/) for storing and retrieving secrets using AWS KMS and DynamoDB.

This code is based on the now defunct `node-credstash` library, but has been updated to TypeScript with up-to-date dependencies.

## Setup

Before using credstasher, you need to:

1. Set up AWS credentials (AWS CLI, environment variables, or IAM roles)
2. Create a KMS key or use an existing one
3. Optionally create a DynamoDB table (the library can create it automatically)

There are commands to help with some of these things, but I would recommend having this stuff set up before you use.

## How to use: CLI

### Install or not

You can install globally using the node package manager of your choice:

```bash
npm install -g node-credstasher

# or

pnpm add -g node-credstasher
```

After it is installed, you should be able to run the following to show the docs:

```bash
credstasher --help
```

Yuu can also run using `npx`, `pnpx`, etc. downloading it to run on the fly. This is kind of nice.

```bash
npx credstasher@latest --help
```

### CLI Usage

#### Setup the DynamoDB table

```bash
credstasher setup
```

#### Store a secret

```bash
credstasher put my-password "supersecret123"
```

### Retrieve a secret

```bash
credstasher get my-password
```

### List all secrets

```bash
credstasher list
```

### Delete a secret

```bash
credstasher delete mypassword
```

### CLI Options

Global options:

- `-r, --region <region>`: AWS region (default: us-east-1)
- `-t, --table <table>`: DynamoDB table name (default: credential-store)
- `-k, --kms-key-id <keyId>`: KMS key ID or alias (default: alias/credstash)
- `-p, --profile <profile>`: AWS profile (default: default)
- `-d, --dynamodb-endpoint <endpoint>`: Custom endpoint URL for DynamoDB
- `-e, --kms-endpoint <endpoint>`: Custom KMS endpoint URL

Command-specific options:

- `put`:
  - `-v, --key-version <version>`: Specific version number
  - `-c, --context <context>`: Encryption context as JSON string
  - `-a, --autoversion`: Automatically increment version
- `get`:
  - `-v, --key-version <version>`: Specific version number
  - `-c, --context <context>`: Encryption context as JSON string
  - `-n, --noline`: Don't append newline to output
- `delete`:
  - `-v, --key-version <version>`: Specific version number
  - `-a, --all`: Delete all versions

## Library Usage

```typescript
import { CredstashClient } from 'node-credstasher';

const client = new CredstashClient({
  region: 'us-east-1',
  table: 'my-secrets',
  kmsKeyId: 'alias/my-key'
});

// Store a secret
await client.putSecret('database-password', 'my-secret-password');

// Retrieve a secret
const password = await client.getSecret('database-password');

// List all secrets
const secrets = await client.listSecrets();

// Delete a secret
await client.deleteSecret('database-password');
```

### Configuration

The `CredstashClient` accepts the following configuration options:

- `region`: AWS region (defaults to AWS_REGION env var or 'us-east-1')
- `kmsRegion`: AWS region for KMS, defaults to `region` value.
- `table`: DynamoDB table name (defaults to CREDSTASH_TABLE env var or 'credential-store')
- `kmsKeyId`: KMS key ID or alias (defaults to CREDSTASH_KMS_KEY_ID env var or 'alias/credstash')
- `profile`: AWS profile (defaults to AWS_PROFILE env var or 'default')
- `dynamodbEndpoint`: Custom endpoint URL for dynamodb
- `kmsEndpoint`: Custom endpoint URL for KMS

### Environment Variables

- `AWS_REGION`: Default AWS region
- `KMS_REGION`: Default AWS region for KMS
- `CREDSTASH_TABLE`: Default DynamoDB table name
- `CREDSTASH_KMS_KEY_ID`: Default KMS key ID
- `AWS_PROFILE`: Default AWS profile
- `DYNAMODB_ENDPOINT`: Custom endpoint URL for dynamodb
- `KMS_ENDPOINT`: Custom endpoint URL for KMS

## Development

### Build

```bash
bun run build
```

### Format and Lint

```bash
bun run format
bun run lint
```

### Check

```bash
bun run check
```

## Security Features

- Uses AWS KMS for key encryption/decryption
- Stores encrypted data in DynamoDB
- Supports encryption context for additional security
- Uses AES-256-GCM for symmetric encryption
- Includes HMAC verification for data integrity
- Supports versioning of secrets

## License

MIT

This project was created using `bun init` in bun v1.2.7. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
