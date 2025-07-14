#!/usr/bin/env node

import { Command } from "commander";
import { CredstashClient } from "./lib/credstash.js";
import type {
  CommandOptions,
  DeleteCommandOptions,
  GetCommandOptions,
  PutCommandOptions,
} from "./lib/models/commands.model.js";
import type {
  CredstashConfig,
  CredstashDeleteOptions,
  CredstashGetOptions,
  CredstashPutOptions,
} from "./lib/models/credstash.model.js";

const DEFAULT_REGION = "us-east-1";
const DEFAULT_TABLE = "credential-store";

const program = new Command();

program
  .name("credstasher")
  .description("CLI tool for credential management using AWS KMS and DynamoDB")
  .version("1.0.0")
  .option("-r, --region <region>", "AWS region", DEFAULT_REGION)
  .option("-t, --table <table>", "DynamoDB table name", DEFAULT_TABLE)
  .option("-k, --kms-key-id <keyId>", "KMS key ID or alias")
  .option("-p, --profile <profile>", "AWS profile")
  .option(
    "-d, --dynamodb-endpoint <endpoint>",
    "Custom endpoint URL for DynamoDB",
  )
  .option("-e, --kms-endpoint <endpoint>", "Custom KMS endpoint URL");

function getCredstashClient(options: CommandOptions): CredstashClient {
  const config: CredstashConfig = {
    region: options.region,
    table: options.table,
    kmsKeyId: options.kmsKeyId,
    profile: options.profile,
    dynamodbEndpoint: options.dynamodbEndpoint,
    kmsEndpoint: options.kmsEndpoint,
  };
  return new CredstashClient(config);
}

program
  .command("list")
  .description("List all stored credentials")
  .action(async (_options) => {
    try {
      const credstash = getCredstashClient(program.opts());
      await credstash.checkForTable();
      const secrets = await credstash.listSecrets();

      if (secrets.length === 0) {
        console.log("No secrets found.");
        return;
      }

      console.log("Stored secrets:\n");
      secrets.forEach((secret) => {
        console.log(`${secret.name} (v: ${secret.version})`);
      });
      console.log(`\nTotal secrets: ${secrets.length}`);
    } catch (error) {
      console.error(
        "Error listing secrets:",
        error instanceof Error ? error.message : error,
      );
      process.exit(1);
    }
  });

program
  .command("put <name> <secret>")
  .description("Store a new credential")
  .option("-v, --key-version <version>", "Version number")
  .option("-c, --context <context>", "Encryption context (JSON string)")
  .option("-a, --autoversion", "Automatically increment version")
  .action(async (name, secret, options: PutCommandOptions) => {
    try {
      const credstash = getCredstashClient(program.opts());
      await credstash.checkForTable();

      const putOptions: CredstashPutOptions = {
        version: options.keyVersion,
        autoversion: options.autoversion,
      };

      if (options.context) {
        try {
          putOptions.context = JSON.parse(options.context);
        } catch (_error) {
          console.error("Invalid JSON in context option");
          process.exit(1);
        }
      }

      await credstash.putSecret(name, secret, putOptions);
      console.log(`Secret '${name}' stored successfully.`);
    } catch (error) {
      console.error(
        "Error storing secret:",
        error instanceof Error ? error.message : error,
      );
      process.exit(1);
    }
  });

program
  .command("get <name>")
  .description("Retrieve a specific credential")
  .option("-v, --key-version <version>", "Version number")
  .option("-c, --context <context>", "Encryption context (JSON string)")
  .option("-n, --noline", "Don't append newline")
  .action(async (name, options: GetCommandOptions) => {
    try {
      const credstash = getCredstashClient(program.opts());
      await credstash.checkForTable();

      const getOptions: CredstashGetOptions = {
        version: options.keyVersion,
        noline: options.noline,
      };

      if (options.context) {
        try {
          getOptions.context = JSON.parse(options.context);
        } catch (_error) {
          console.error("Invalid JSON in context option");
          process.exit(1);
        }
      }

      const secret = await credstash.getSecret(name, getOptions);

      if (options.noline) {
        process.stdout.write(secret);
      } else {
        console.log(secret);
      }
    } catch (error) {
      console.error(
        "Error retrieving secret:",
        error instanceof Error ? error.message : error,
      );
      process.exit(1);
    }
  });

program
  .command("delete <name>")
  .description("Delete a credential")
  .option("-v, --key-version <version>", "Version number")
  .option("-a, --all", "Delete all versions")
  .action(async (name, options: DeleteCommandOptions) => {
    try {
      const credstash = getCredstashClient(program.opts());
      await credstash.checkForTable();

      const deleteOptions: CredstashDeleteOptions = {
        version: options.keyVersion,
        all: options.all,
      };

      await credstash.deleteSecret(name, deleteOptions);

      if (options.all) {
        console.log(`All versions of secret '${name}' deleted successfully.`);
      } else {
        console.log(`Secret '${name}' deleted successfully.`);
      }
    } catch (error) {
      console.error(
        "Error deleting secret:",
        error instanceof Error ? error.message : error,
      );
      process.exit(1);
    }
  });

program
  .command("setup")
  .description("Create the DynamoDB table for credstash")
  .action(async () => {
    try {
      const credstash = getCredstashClient(program.opts());
      await credstash.ensureTableExists();
      console.log("DynamoDB table created or already exists.");
    } catch (error) {
      console.error(
        "Error setting up table:",
        error instanceof Error ? error.message : error,
      );
      process.exit(1);
    }
  });

program.parse();
