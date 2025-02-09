import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { format } from "date-fns";
import { ProxyAgent, fetch, RequestInit, Response } from "undici";
import JSZip from "jszip";

interface FetchCacherOptions {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint?: string; // Optional endpoint for B2 S3-compatible API
  proxyUri?: string; // Optional HTTP proxy URI
  maxRetries?: number; // Optional max retries for 408 errors
}

interface CachedResponse {
  url: string;
  timestamp: string;
  contentType: string;
  body: string;
}

const ENV_PREFIX = "FETCH_CACHER_" as const;
const REQUIRED_ENV_VARS = [
  "REGION",
  "ACCESS_KEY_ID",
  "SECRET_ACCESS_KEY",
  "BUCKET_NAME",
] as const;

const DEFAULT_MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export class FetchCacher {
  private s3: S3Client;
  private zip: JSZip;
  private responses: CachedResponse[] = [];
  private bucketName: string;
  private proxyAgent?: ProxyAgent;
  private maxRetries: number;
  private startTime: Date;

  constructor(options: FetchCacherOptions) {
    // Setup proxy agent if proxy URI is provided
    if (options.proxyUri) {
      this.proxyAgent = new ProxyAgent({
        uri: options.proxyUri,
      });
    }

    this.s3 = new S3Client({
      region: options.region,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
      ...(options.endpoint && {
        endpoint: options.endpoint,
        forcePathStyle: true, // Required for B2
      }),
    });

    this.bucketName = options.bucketName;
    this.maxRetries = options.maxRetries || DEFAULT_MAX_RETRIES;
    this.zip = new JSZip();
    this.startTime = new Date();
  }

  static fromEnv(): FetchCacher {
    const config: Record<string, string> = {};

    // Check all required env vars
    for (const key of REQUIRED_ENV_VARS) {
      const envVar = process.env[`${ENV_PREFIX}${key}`];
      if (!envVar) {
        throw new Error(`${ENV_PREFIX}${key} environment variable is required`);
      }
      config[key.toLowerCase()] = envVar;
    }

    // Optional endpoint for B2
    const endpoint = process.env[`${ENV_PREFIX}ENDPOINT`];
    // Optional proxy URI
    const proxyUri = process.env.PROXY_URI;
    // Optional max retries
    const maxRetries = process.env.FETCH_CACHER_MAX_RETRIES
      ? parseInt(process.env.FETCH_CACHER_MAX_RETRIES, 10)
      : DEFAULT_MAX_RETRIES;

    return new FetchCacher({
      region: config.region,
      accessKeyId: config.access_key_id,
      secretAccessKey: config.secret_access_key,
      bucketName: config.bucket_name,
      maxRetries,
      ...(endpoint && { endpoint }),
      ...(proxyUri && { proxyUri }),
    });
  }

  private async retryS3Upload(
    params: {
      Bucket: string;
      Key: string;
      Body: Buffer;
      ContentType: string;
    },
    retryCount = 0
  ): Promise<void> {
    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: params.Bucket,
          Key: params.Key,
          Body: params.Body,
          ContentType: params.ContentType,
        })
      );
    } catch (error: any) {
      // Check if it's a 408 error or if error.code is RequestTimeout
      if (
        (error.statusCode === 408 || error.code === "RequestTimeout") &&
        retryCount < this.maxRetries
      ) {
        console.warn(
          `S3 upload timeout, retrying (${retryCount + 1}/${this.maxRetries})`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, retryCount))
        );
        return this.retryS3Upload(params, retryCount + 1);
      }
      throw error;
    }
  }

  async fetch(input: string | URL, init?: RequestInit): Promise<Response> {
    const fetchOptions: RequestInit = {
      ...init,
      dispatcher: this.proxyAgent,
    };

    const response = await fetch(input, fetchOptions);
    const url = typeof input === "string" ? input : input.toString();

    // Clone the response since we need to read it twice
    const responseClone = response.clone();

    // Get the response body as text
    const body = await responseClone.text();

    // Store the response data
    this.responses.push({
      url,
      timestamp: new Date().toISOString(),
      contentType:
        response.headers.get("content-type") || "application/octet-stream",
      body,
    });

    return response;
  }

  async waitForPendingUploads() {
    try {
      // Create a manifest file with metadata
      const manifest = {
        startTime: this.startTime.toISOString(),
        endTime: new Date().toISOString(),
        totalResponses: this.responses.length,
        responses: this.responses.map((r) => ({
          url: r.url,
          timestamp: r.timestamp,
          contentType: r.contentType,
        })),
      };

      // Add manifest to zip
      this.zip.file("manifest.json", JSON.stringify(manifest, null, 2));

      // Add each response to the zip with a clean filename
      for (const response of this.responses) {
        const cleanUrl = response.url.replace(/[^a-z0-9]/gi, "_").toLowerCase();
        const filename = `${response.timestamp}-${cleanUrl}.txt`;
        this.zip.file(filename, response.body);
      }

      // Generate zip file
      const zipBuffer = await this.zip.generateAsync({ type: "nodebuffer" });

      // Generate the path with date and timestamp
      const date = format(this.startTime, "yyyy-MM-dd");
      const timestamp = this.startTime.toISOString();
      const objectKey = `${date}/${timestamp}-responses.zip`;

      // Upload zip to S3
      await this.retryS3Upload({
        Bucket: this.bucketName,
        Key: objectKey,
        Body: zipBuffer,
        ContentType: "application/zip",
      });

      // Clear the responses array and create a new zip
      this.responses = [];
      this.zip = new JSZip();
      this.startTime = new Date();
    } catch (error) {
      console.error("Error uploading zip to S3:", error);
      throw error;
    }
  }
}
