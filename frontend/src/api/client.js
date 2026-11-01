// Thin transport helpers. They only deal with HTTP; interpretation of results
// lives in lib/screening.js.

export class ApiError extends Error {
  constructor(message, { status = null, body = null, kind = "http" } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.kind = kind; // "network" | "http" | "parse"
  }
}

function messageFrom(body) {
  if (!body || typeof body !== "object") return null;
  const value = body.error ?? body.message;
  if (value == null) return null;
  return typeof value === "string" ? value : JSON.stringify(value);
}

export async function postJson(url, payload) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new ApiError(
      "Could not reach the service. Check your connection, or whether the API allows requests from this origin (CORS).",
      { kind: "network" },
    );
  }

  const text = await response.text();
  let body = null;
  let parseFailed = false;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      parseFailed = true;
    }
  }

  if (!response.ok) {
    throw new ApiError(messageFrom(body) || `Request failed (HTTP ${response.status}).`, {
      status: response.status,
      body,
      kind: "http",
    });
  }
  if (parseFailed || body === null || typeof body !== "object") {
    throw new ApiError("The service returned an unreadable response.", {
      status: response.status,
      kind: "parse",
    });
  }
  return body;
}

// Direct-to-S3 upload with the presigned URL. Uses XHR (not fetch) so the UI
// can show real upload progress. Method and Content-Type match the original flow.
export function putToPresignedUrl(url, file, contentType, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new ApiError(`Storage upload failed with status ${xhr.status}.`, { status: xhr.status }));
    };
    xhr.onerror = () =>
      reject(new ApiError("Network error while uploading to storage.", { kind: "network" }));
    xhr.onabort = () => reject(new ApiError("Upload was cancelled.", { kind: "network" }));
    xhr.send(file);
  });
}
