import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { CredstashClient } from "../src/lib/credstash.js";
import type { CredstashConfig } from "../src/lib/models/credstash.model.js";

// Configuration for local testing
const localConfig: CredstashConfig = {
  kmsEndpoint: "http://localhost:4599", // local-kms endpoint
  dynamodbEndpoint: "http://localhost:8000", // local-dynamodb endpoint
  region: "us-east-1",
  kmsRegion: "us-east-1",
  table: "credential-store-test-commands",
  kmsKeyId: "alias/credstash",
};

describe("CredstashClient", () => {
  let client: CredstashClient;
  const originalEnv = process.env;

  beforeAll(async () => {
    // Clear environment variables before each test
    // We do this because we are testing defaults here. We set our test
    // specific config using localConfig above.
    process.env = {};

    // Create client with local configuration
    client = new CredstashClient(localConfig);

    // Ensure table exists (this will create it if it doesn't exist)
    console.log("📊 Setting up DynamoDB table...");
    await client.ensureTableExists();
    console.log("✅ Table ready!");
  });

  afterAll(() => {
    // Restore original environment variables
    process.env = originalEnv;
  });

  test("should initialize with default configuration", () => {
    const originalEnv = process.env;
    process.env = {}; // Clear environment variables for this test

    const client = new CredstashClient();

    expect(client.config.region).toBe("us-east-1");
    expect(client.config.table).toBe("credential-store");
    expect(client.config.kmsKeyId).toBe("alias/credstash");
    expect(client.config.kmsRegion).toBe("us-east-1");
    expect(client.config.profile).toBe("default");
    expect(client.config.kmsEndpoint).toBe("");
    expect(client.config.dynamodbEndpoint).toBe("");

    // Restore original environment variables
    process.env = originalEnv;
  });

  test("should store and retrieve a secret", async () => {
    const secretName = "test-secret";
    const secretValue = "Hello, local KMS!";

    // Store the secret
    await client.putSecret(secretName, secretValue);

    // Retrieve the secret
    const retrievedSecret = await client.getSecret(secretName);

    expect(retrievedSecret).toBe(secretValue);
  });

  test("should store and retrieve a secret with encryption context", async () => {
    const secretName = "test-secret-with-context";
    const secretValue = "Hello, local KMS with context!";
    const encryptionContext = { environment: "test", application: "credstash" };

    // Store the secret with context
    await client.putSecret(secretName, secretValue, {
      context: encryptionContext,
    });

    // Retrieve the secret with context
    const retrievedSecret = await client.getSecret(secretName, {
      context: encryptionContext,
    });

    expect(retrievedSecret).toBe(secretValue);
  });

  test("should list all stored secrets", async () => {
    // Store a few test secrets
    await client.putSecret("list-test-1", "value1");
    await client.putSecret("list-test-2", "value2");
    await client.putSecret("list-test-3", "value3");

    // List all secrets
    const secrets = await client.listSecrets();

    expect(secrets).toBeInstanceOf(Array);
    expect(secrets.length).toBeGreaterThanOrEqual(3);

    // Check that our test secrets are in the list
    const secretNames = secrets.map((s) => s.name);
    expect(secretNames).toContain("list-test-1");
    expect(secretNames).toContain("list-test-2");
    expect(secretNames).toContain("list-test-3");
  });

  test("should handle secret versioning", async () => {
    const secretName = "versioned-secret";
    const originalValue = "version 1";
    const updatedValue = "version 2";

    // Store initial version
    await client.putSecret(secretName, originalValue);

    // Update the secret (creates new version)
    await client.putSecret(secretName, updatedValue);

    // Retrieve latest version
    const latestSecret = await client.getSecret(secretName);
    expect(latestSecret).toBe(updatedValue);

    // List versions to verify both exist
    const secrets = await client.listSecrets();
    const secretVersions = secrets.filter((s) => s.name === secretName);
    expect(secretVersions.length).toBeGreaterThanOrEqual(2);
  });

  test("should delete secrets", async () => {
    const secretName = "delete-test-secret";
    const secretValue = "to be deleted";

    // Store the secret
    await client.putSecret(secretName, secretValue);

    // Verify it exists
    const retrievedSecret = await client.getSecret(secretName);
    expect(retrievedSecret).toBe(secretValue);

    // Delete the secret
    await client.deleteSecret(secretName);

    // Verify it's gone (should throw an error)
    await expect(client.getSecret(secretName)).rejects.toThrow();
  });

  test("should fail to retrieve secret with wrong encryption context", async () => {
    const secretName = "context-test-secret";
    const secretValue = "context sensitive";
    const correctContext = { environment: "test" };
    const wrongContext = { environment: "prod" };

    // Store secret with context
    await client.putSecret(secretName, secretValue, {
      context: correctContext,
    });

    // Try to retrieve with wrong context (should fail)
    await expect(
      client.getSecret(secretName, { context: wrongContext }),
    ).rejects.toThrow();

    // Verify it works with correct context
    const retrievedSecret = await client.getSecret(secretName, {
      context: correctContext,
    });
    expect(retrievedSecret).toBe(secretValue);
  });
});
