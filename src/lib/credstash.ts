import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ResourceNotFoundException,
} from "@aws-sdk/client-dynamodb";
import { KMSClient } from "@aws-sdk/client-kms";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import * as kms from "./kms.js";
import type {
  CredstashConfig,
  CredstashDeleteOptions,
  CredstashGetOptions,
  CredstashItem,
  CredstashListItem,
  CredstashPutOptions,
} from "./models/credstash.model.js";

const DEFAULT_REGION = "us-east-1";
const DEFAULT_TABLE = "credential-store";
const DEFAULT_KMS_KEY_ID = "alias/credstash";
const DEFAULT_KMS_REGION = "us-east-1";
const DEFAULT_PROFILE = "default";

export class CredstashClient {
  config: Required<CredstashConfig>;

  private dynamoClient: DynamoDBClient;
  private docClient: DynamoDBDocumentClient;
  private kmsClient: KMSClient;

  constructor(config: CredstashConfig = {}) {
    const region = config.region || process.env.AWS_REGION || DEFAULT_REGION;
    const kmsRegion =
      config.kmsRegion ||
      process.env.KMS_REGION ||
      config.region ||
      DEFAULT_KMS_REGION;
    this.config = {
      region,
      kmsRegion,
      table: config.table || process.env.CREDSTASH_TABLE || DEFAULT_TABLE,
      kmsKeyId:
        config.kmsKeyId ||
        process.env.CREDSTASH_KMS_KEY_ID ||
        DEFAULT_KMS_KEY_ID,
      profile: config.profile || process.env.AWS_PROFILE || DEFAULT_PROFILE,
      dynamodbEndpoint:
        config.dynamodbEndpoint || process.env.DYNAMODB_ENDPOINT || "",
      kmsEndpoint: config.kmsEndpoint || process.env.KMS_ENDPOINT || "",
    };

    this.dynamoClient = new DynamoDBClient({
      region: this.config.region,
      endpoint: this.config.dynamodbEndpoint || undefined,
    });
    this.kmsClient = new KMSClient({
      region: this.config.kmsRegion,
      endpoint: this.config.kmsEndpoint || undefined,
    });
    this.docClient = DynamoDBDocumentClient.from(this.dynamoClient);
  }

  async checkForTable(): Promise<void> {
    try {
      await this.dynamoClient.send(
        new DescribeTableCommand({
          TableName: this.config.table,
        }),
      );
    } catch (error) {
      if (error instanceof ResourceNotFoundException) {
        throw new Error(
          `Credstash table '${this.config.table}' not found. Please create it first. You can run 'credstasher setup' to create it.`,
        );
      } else {
        throw error;
      }
    }
  }

  async ensureTableExists(): Promise<void> {
    try {
      await this.dynamoClient.send(
        new DescribeTableCommand({
          TableName: this.config.table,
        }),
      );
    } catch (error) {
      if (error instanceof ResourceNotFoundException) {
        await this.createTable();
      } else {
        throw error;
      }
    }
  }

  private async createTable(): Promise<void> {
    const createTableCommand = new CreateTableCommand({
      TableName: this.config.table,
      KeySchema: [
        { AttributeName: "name", KeyType: "HASH" },
        { AttributeName: "version", KeyType: "RANGE" },
      ],
      AttributeDefinitions: [
        { AttributeName: "name", AttributeType: "S" },
        { AttributeName: "version", AttributeType: "S" },
      ],
      BillingMode: "PAY_PER_REQUEST",
    });

    await this.dynamoClient.send(createTableCommand);
  }

  async putSecret(
    name: string,
    secret: string,
    options: CredstashPutOptions = {},
  ): Promise<void> {
    const version = options.version || (await this.getNextVersion(name));
    const kmsKeyId = options.kmsKeyId || this.config.kmsKeyId;

    const encryptedItem = await kms.encryptItem(
      secret,
      kmsKeyId,
      this.kmsClient,
      options,
    );

    const itemRow: CredstashItem = {
      name,
      version,
      ...encryptedItem,
    };

    // Store in DynamoDB
    await this.docClient.send(
      new PutCommand({
        TableName: this.config.table,
        Item: itemRow,
      }),
    );
  }

  async getSecret(
    name: string,
    options: CredstashGetOptions = {},
  ): Promise<string> {
    // Get from DynamoDB
    const response = await this.docClient.send(
      new QueryCommand({
        TableName: this.config.table,
        ConsistentRead: true,
        ScanIndexForward: false,
        KeyConditionExpression: "#name = :name",
        ExpressionAttributeNames: {
          "#name": "name",
        },
        ExpressionAttributeValues: {
          ":name": name,
        },
      }),
    );

    if (!response.Items || response.Items.length === 0) {
      throw new Error(`Secret '${name}' not found`);
    }

    let item: CredstashItem;

    if (options.version !== undefined) {
      // If a version is set, look for the right one
      item = response.Items.find(
        (item) => item.version === options.version,
      ) as CredstashItem;

      // Not found, raise error.
      if (!item) {
        throw new Error(
          `Version '${options.version}' of secret '${name}' not found`,
        );
      }
    } else {
      // Otherwise, we take the top one. This will be the most recent version.
      item = response.Items[0] as CredstashItem;
    }

    return await kms.decryptItem(item, this.kmsClient, options);
  }

  async deleteSecret(
    name: string,
    options: CredstashDeleteOptions = {},
  ): Promise<void> {
    if (options.all) {
      const versions = await this.listVersions(name);
      for (const version of versions) {
        await this.docClient.send(
          new DeleteCommand({
            TableName: this.config.table,
            Key: { name, version: version.version },
          }),
        );
      }
    } else {
      const version = options.version || (await this.getLatestVersion(name));
      await this.docClient.send(
        new DeleteCommand({
          TableName: this.config.table,
          Key: { name, version },
        }),
      );
    }
  }

  async listSecrets(): Promise<CredstashListItem[]> {
    const items: CredstashListItem[] = [];
    let lastEvaluatedKey: Record<string, string> | undefined;

    do {
      const response = await this.docClient.send(
        new ScanCommand({
          TableName: this.config.table,
          ProjectionExpression: "#name, version, #comment",
          ExpressionAttributeNames: {
            "#name": "name",
            "#comment": "comment",
          },
          ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
        }),
      );

      if (response.Items) {
        items.push(...(response.Items as CredstashListItem[]));
      }

      lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return items.map((item) => ({
      name: item.name,
      version: item.version,
    }));
  }

  private async listVersions(name: string): Promise<CredstashListItem[]> {
    const response = await this.docClient.send(
      new QueryCommand({
        TableName: this.config.table,
        KeyConditionExpression: "#name = :name",
        ExpressionAttributeNames: {
          "#name": "name",
        },
        ExpressionAttributeValues: {
          ":name": name,
        },
        ProjectionExpression: "#name, version",
      }),
    );

    return (response.Items || []).map((item) => ({
      name: item.name,
      version: item.version,
    }));
  }

  private async getLatestVersion(name: string): Promise<string> {
    const versions = await this.listVersions(name);
    if (versions.length === 0) {
      throw new Error(`Secret '${name}' not found`);
    }

    const numericVersions = versions
      .map((v) => Number.parseInt(v.version, 10))
      .filter((v) => !Number.isNaN(v))
      .sort((a, b) => b - a);

    return numericVersions.length > 0
      ? (numericVersions[0]?.toString() ?? "1")
      : "1";
  }

  private async getNextVersion(name: string): Promise<string> {
    try {
      const latestVersion = await this.getLatestVersion(name);
      return (Number.parseInt(latestVersion, 10) + 1).toString();
    } catch (_error) {
      return "1";
    }
  }
}
