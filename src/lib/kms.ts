import {
  DecryptCommand,
  GenerateDataKeyCommand,
  type KMSClient,
} from "@aws-sdk/client-kms";
import AES from "aes-js";
import crypto from "crypto";
import type {
  CredstashGetOptions,
  CredstashItem,
} from "./models/credstash.model";

const DEFAULT_DIGEST = "sha256";

/**
 * Decrypts a secret item from DynamoDB.
 *
 * @param dbItem the item from DynamoDB
 * @param kmsClient the KMS client
 * @param options optional parameters for decryption
 *
 * @returns the decrypted secret
 */
export const decryptItem = async (
  dbItem: CredstashItem,
  kmsClient: KMSClient,
  options: CredstashGetOptions = {},
) => {
  // Process values to use here
  const item = {
    contents: dbItem.contents,
    hmac: Buffer.from(dbItem.hmac).toString("utf-8"),
    key: dbItem.key,
    digest: dbItem.digest ?? DEFAULT_DIGEST,
  };

  // If options are set for our encryption context, set them up to use.
  const encryptionContext = options.context
    ? { EncryptionContext: { ...options.context } }
    : {};

  // Decrypt the item key
  const decryptedItem = await kmsClient.send(
    new DecryptCommand({
      CiphertextBlob: Buffer.from(item.key, "base64"),
      ...encryptionContext,
    }),
  );

  if (!decryptedItem.Plaintext) {
    throw new Error("Failed to decrypt item key");
  }

  // hmac comparison
  const key = decryptedItem.Plaintext.slice(0, 32);
  const hmacKey = decryptedItem.Plaintext.slice(32);
  const contents = Buffer.from(item.contents, "base64");

  const hmac = crypto.createHmac(item.digest, hmacKey);
  hmac.update(contents);
  const hmacHex = hmac.digest("hex");

  if (hmacHex !== item.hmac) {
    throw new Error("HMAC verification failed");
  }

  // Decrypt the secret
  const decrypt = new AES.ModeOfOperation.ctr(key);
  const decryptedBytes = decrypt.decrypt(contents);
  const plaintext = AES.utils.utf8.fromBytes(decryptedBytes);

  return plaintext;
};

/**
 * Encrypts a secret using KMS and AES.
 *
 * @param keyId the key for the secret
 * @param secret the secret to encrypt
 * @param kmsClient the KMS client
 * @param options optional parameters, will be used in the encryption context
 *
 * @returns the encrypted item, ready for Dyanamodb
 */
export const encryptItem = async (
  secret: string,
  kmsKeyId: string,
  kmsClient: KMSClient,
  options: CredstashGetOptions = {},
) => {
  // If a contest is provided, prepare to pass to the GenerateDateKeyCommand
  const encryptionContext = options.context
    ? { EncryptionContext: options.context }
    : {};

  // Generate data key using KMS
  const dataKeyResponse = await kmsClient.send(
    new GenerateDataKeyCommand({
      KeyId: kmsKeyId,
      NumberOfBytes: 64,
      ...encryptionContext,
    }),
  );

  if (!dataKeyResponse.Plaintext || !dataKeyResponse.CiphertextBlob) {
    throw new Error("Failed to generate data key");
  }

  // First 32 bits are the key, last 32 are the hmac key
  const key = dataKeyResponse.Plaintext.slice(0, 32);
  const hmacKey = dataKeyResponse.Plaintext.slice(32);

  // This is the "wrapped key"  which gets stored in dynamo
  const encryptedKey = dataKeyResponse.CiphertextBlob;

  // Encrypt the value
  const encrypt = new AES.ModeOfOperation.ctr(key);
  const valueBytes = AES.utils.utf8.toBytes(secret);
  const encryptedValue = encrypt.encrypt(valueBytes);

  // Compute HMAC
  const hmac = crypto.createHmac(DEFAULT_DIGEST, hmacKey);
  hmac.update(encryptedValue);
  const hmacHex = hmac.digest("hex");

  return {
    contents: Buffer.from(encryptedValue).toString("base64"),
    hmac: hmacHex,
    key: Buffer.from(encryptedKey).toString("base64"),
    digest: DEFAULT_DIGEST,
  };
};
