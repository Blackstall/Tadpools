import { Client } from "minio";

export const TEMP_BUCKET = "tadpools-temp";

export const minio = new Client({
  endPoint: process.env.MINIO_ENDPOINT ?? "localhost",
  port: Number(process.env.MINIO_PORT ?? 9000),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY ?? "minio",
  secretKey: process.env.MINIO_SECRET_KEY ?? "minio123",
});

export async function ensureBucket(): Promise<void> {
  const exists = await minio.bucketExists(TEMP_BUCKET);
  if (!exists) {
    await minio.makeBucket(TEMP_BUCKET);
    console.log(`[minio] created bucket: ${TEMP_BUCKET}`);
  }
}
