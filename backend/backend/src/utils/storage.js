const { v2: cloudinary } = require("cloudinary");
const { HttpError } = require("./helpers");

// Task attachments live in Cloudinary as "authenticated" (private) assets: they have no public URL,
// and the API hands out short-lived signed download links only to people who can see the task.
let configured = false;
function client() {
  if (!configured) {
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      throw new HttpError(503, "File storage is not configured (CLOUDINARY_* in config.env)");
    }
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

const FOLDER = () => process.env.CLOUDINARY_FOLDER || "pulse";

// Uploads a multer in-memory file. Everything is stored as "raw" so any file type keeps its bytes as-is.
function uploadFile(file, taskId) {
  const cl = client();
  return new Promise((resolve, reject) => {
    const stream = cl.uploader.upload_stream(
      { folder: `${FOLDER()}/tasks/${taskId}`, resource_type: "raw", type: "authenticated", use_filename: true, unique_filename: true },
      (err, result) => (err ? reject(new HttpError(502, `Upload failed: ${err.message}`)) : resolve({ publicId: result.public_id }))
    );
    stream.end(file.buffer);
  });
}

// Signed link that works for a few minutes
function downloadUrl(publicId, { expiresInSeconds = 300 } = {}) {
  return client().utils.private_download_url(publicId, "", {
    resource_type: "raw",
    type: "authenticated",
    expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
    attachment: true,
  });
}

async function deleteFile(publicId) {
  await client().uploader.destroy(publicId, { resource_type: "raw", type: "authenticated", invalidate: true });
}

module.exports = { uploadFile, downloadUrl, deleteFile };
