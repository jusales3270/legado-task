import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("Supabase credentials not configured. File uploads will use local storage.");
}

export const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export const STORAGE_BUCKET = "client-uploads";

export async function ensureBucketExists() {
  if (!supabase) return false;

  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === STORAGE_BUCKET);

    if (!bucketExists) {
      const { error } = await supabase.storage.createBucket(STORAGE_BUCKET, {
        public: true,
        fileSizeLimit: 52428800, // 50MB (Supabase free tier limit)
      });

      if (error) {
        console.error("Error creating bucket:", error.message);
        return false;
      }
      console.log(`Bucket '${STORAGE_BUCKET}' created successfully`);
    }

    return true;
  } catch (error) {
    console.error("Error checking/creating bucket:", error);
    return false;
  }
}

export async function uploadToSupabase(
  file: Buffer,
  fileName: string,
  mimeType: string
): Promise<{ url: string; path: string } | null> {
  if (!supabase) return null;

  const timestamp = Date.now();
  const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const filePath = `uploads/${timestamp}_${safeName}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    console.error("Supabase upload error:", error.message);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath);

  return {
    url: urlData.publicUrl,
    path: filePath,
  };
}

export async function getSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(filePath, expiresIn);

  if (error) {
    console.error("Error creating signed URL:", error.message);
    return null;
  }

  return data.signedUrl;
}

export async function deleteFromSupabase(filePath: string): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([filePath]);

  if (error) {
    console.error("Supabase delete error:", error.message);
    return false;
  }

  return true;
}

export async function createSignedUploadUrl(
  fileName: string,
  contentType: string
): Promise<{ url: string; token: string; path: string; publicUrl: string } | null> {
  if (!supabase) return null;

  const timestamp = Date.now();
  const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const filePath = `uploads/${timestamp}_${safeName}`;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(filePath);

  if (error) {
    console.error("Supabase signed url error:", error.message);
    return null;
  }

  // Get the public URL for reference (assuming bucket is public)
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath);

  return {
    url: data.signedUrl,
    token: data.token,
    path: data.path,
    publicUrl: urlData.publicUrl,
  };
}
