import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { format } from "date-fns";
import { ProxyAgent, fetch, RequestInit, Response } from "undici";
import JSZip from "jszip";
import ProxyChain from "proxy-chain";
interface FetchCacherOptions {
  s3Client?: S3Client | null;
  bucketName?: string;
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
  private s3: S3Client | null;
  private zip: JSZip;
  private responses: CachedResponse[] = [];
  private bucketName: string | null;
  private proxyAgent?: ProxyAgent;
  private maxRetries: number;
  private startTime: Date;

  constructor(options: FetchCacherOptions) {
    // Setup proxy agent if proxy URI is provided
    if (options.proxyUri) {
      const server = new ProxyChain.Server({
        port: 8069,
        host: "localhost",
        prepareRequestFunction: ({}) => {
          return {
            upstreamProxyUrl: `${options.proxyUri}`,
          };
        },
      });
      this.proxyAgent = new ProxyAgent({
        uri: `http://localhost:8069`,
      });
    }

    this.s3 = options.s3Client || createS3ClientFromEnv();
    this.bucketName = options.bucketName || BUCKET_NAME;
    this.maxRetries = options.maxRetries || DEFAULT_MAX_RETRIES;
    this.zip = new JSZip();
    this.startTime = new Date();
  }

  static fromEnv(): FetchCacher {
    // Optional proxy URI
    const proxyUri = process.env.PROXY_URI;
    // Optional max retries
    const maxRetries = process.env.FETCH_CACHER_MAX_RETRIES
      ? parseInt(process.env.FETCH_CACHER_MAX_RETRIES, 10)
      : DEFAULT_MAX_RETRIES;

    return new FetchCacher({
      maxRetries,
      ...(proxyUri && { proxyUri }),
    });
  }

  private async retryS3Upload(
    params: {
      Bucket: string;
      Key: string;
      Body: any;
      ContentType: string;
    },
    retryCount = 0,
  ): Promise<void> {
    if (!this.s3) {
      console.log(`📁 [NO-CREDS] Would upload to S3: ${params.Key}`);
      return;
    }
    
    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: params.Bucket,
          Key: params.Key,
          Body: params.Body,
          ContentType: params.ContentType,
        }),
      );
    } catch (error: any) {
      if (retryCount < this.maxRetries) {
        console.warn(
          `S3 upload error, retrying (${retryCount + 1}/${this.maxRetries})`,
          error,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, retryCount)),
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
      if (this.bucketName) {
        await this.retryS3Upload({
          Bucket: this.bucketName,
          Key: objectKey,
          Body: zipBuffer,
          ContentType: "application/zip",
        });
      }

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

export function createS3ClientFromEnv(): S3Client | null {
  const region = process.env[`${ENV_PREFIX}REGION`];
  const accessKeyId = process.env[`${ENV_PREFIX}ACCESS_KEY_ID`];
  const secretAccessKey = process.env[`${ENV_PREFIX}SECRET_ACCESS_KEY`];
  const endpoint = process.env[`${ENV_PREFIX}ENDPOINT`];

  if (!region || !accessKeyId || !secretAccessKey) {
    console.log("⚠️  S3 credentials not found - caching will be disabled");
    return null;
  }

  return new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    ...(endpoint && {
      endpoint,
      forcePathStyle: true, // Required for B2
    }),
  });
}

export const s3 = createS3ClientFromEnv();
export const BUCKET_NAME = process.env[`${ENV_PREFIX}BUCKET_NAME`];
