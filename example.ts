#!/usr/bin/env node

/**
 * Example usage of the node-credstasher library
 */

import { CredstashClient } from "./src/index.js";

async function example() {
  console.log("Node Credstasher Example");
  console.log("========================");

  // Create a client with default configuration
  const _client = new CredstashClient({
    region: "us-east-1",
    table: "credential-store-example",
    kmsKeyId: "alias/credstash",
  });

  try {
    // Note: This example doesn't actually run AWS operations
    // since it requires valid AWS credentials and resources

    console.log("Client created successfully!");
    console.log("Configuration:", {
      region: "us-east-1",
      table: "credential-store-example",
      kmsKeyId: "alias/credstash",
    });

    console.log("\nExample API usage:");
    console.log("------------------");
    console.log("// Store a secret");
    console.log(
      "await client.putSecret('database-password', 'supersecret123');",
    );

    console.log("\n// Retrieve a secret");
    console.log(
      "const password = await client.getSecret('database-password');",
    );

    console.log("\n// List all secrets");
    console.log("const secrets = await client.listSecrets();");

    console.log("\n// Delete a secret");
    console.log("await client.deleteSecret('database-password');");

    console.log("\nCLI usage:");
    console.log("----------");
    console.log('bun run commands.ts put mypassword "supersecret123"');
    console.log("bun run commands.ts get mypassword");
    console.log("bun run commands.ts list");
    console.log("bun run commands.ts delete mypassword");
  } catch (error) {
    console.error("Error:", error);
  }
}

example().catch(console.error);
