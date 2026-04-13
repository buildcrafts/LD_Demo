import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const rootDir = dirname(__filename);
const publicDir = join(rootDir, "public");
const vendorFile = join(
  rootDir,
  "node_modules",
  "@launchdarkly",
  "js-client-sdk",
  "dist",
  "index.js",
);

loadDotEnv();

const port = Number(process.env.PORT || 3000);
// Only browser-safe LaunchDarkly values are exposed to the client from this object.
const publicConfig = {
  clientSideId: process.env.LD_CLIENT_SIDE_ID || "",
  flagKey: process.env.LD_FLAG_KEY || "revamped-hero",
  projectKey: process.env.LD_PROJECT_KEY || "",
  environmentKey: process.env.LD_ENV_KEY || "",
  canRemediate: Boolean(
    process.env.LD_API_TOKEN &&
      process.env.LD_PROJECT_KEY &&
      process.env.LD_ENV_KEY &&
      process.env.LD_FLAG_KEY,
  ),
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/config") {
      return respondJson(res, 200, publicConfig);
    }

    if (req.method === "GET" && url.pathname === "/health") {
      return respondJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/remediate") {
      return updateFlagState(req, res);
    }

    if (req.method === "GET" && url.pathname === "/vendor/launchdarkly-sdk.js") {
      const contents = await readFile(vendorFile, "utf8");
      return respondText(res, 200, contents, "text/javascript; charset=utf-8");
    }

    if (req.method === "GET") {
      const filePath =
        url.pathname === "/"
          ? join(publicDir, "index.html")
          : join(publicDir, safePath(url.pathname));

      const contents = await readFile(filePath);
      return respondBinary(res, 200, contents, mimeType(filePath));
    }

    respondJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return respondJson(res, 404, { error: "Not found" });
    }

    return respondJson(res, 500, {
      error: "Unexpected server error",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(port, () => {
  console.log(`LaunchDarkly demo running at http://localhost:${port}`);
});

function loadDotEnv() {
  const envPath = join(rootDir, ".env");

  try {
    const content = readFileSync(envPath, "utf8");

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // A missing .env file is acceptable because environment variables may be injected by the shell.
  }
}

async function updateFlagState(req, res) {
  const { LD_API_TOKEN, LD_PROJECT_KEY, LD_ENV_KEY, LD_FLAG_KEY } = process.env;

  if (!LD_API_TOKEN || !LD_PROJECT_KEY || !LD_ENV_KEY || !LD_FLAG_KEY) {
    return respondJson(res, 400, {
      error: "Remediation is not configured",
      detail:
        "Set LD_API_TOKEN, LD_PROJECT_KEY, LD_ENV_KEY, and LD_FLAG_KEY in .env to enable the in-app kill switch.",
    });
  }

  const requestBody = await readJsonBody(req);
  const desiredState = requestBody?.action === "on" ? "on" : "off";
  const instructionKind = desiredState === "on" ? "turnFlagOn" : "turnFlagOff";
  const comment =
    desiredState === "on"
      ? "Triggered from local release demo"
      : "Triggered from local remediation demo";

  const response = await fetch(
    // The flag referenced here must already exist in LaunchDarkly for the configured project/environment.
    `https://app.launchdarkly.com/api/v2/flags/${LD_PROJECT_KEY}/${LD_FLAG_KEY}`,
    {
      method: "PATCH",
      headers: {
        Authorization: LD_API_TOKEN,
        "Content-Type": "application/json; domain-model=launchdarkly.semanticpatch",
      },
      body: JSON.stringify({
        comment,
        environmentKey: LD_ENV_KEY,
        instructions: [{ kind: instructionKind }],
      }),
    },
  );

  const body = await response.text();

  if (!response.ok) {
    return respondJson(res, response.status, {
      error: "LaunchDarkly API request failed",
      detail: body,
    });
  }

  return respondJson(res, 200, {
    ok: true,
    message: `Flag "${LD_FLAG_KEY}" turned ${desiredState} in environment "${LD_ENV_KEY}".`,
  });
}

async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

function safePath(pathname) {
  return pathname.replace(/^\/+/, "").replace(/\.\./g, "");
}

function mimeType(filePath) {
  switch (extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function respondJson(res, statusCode, payload) {
  respondText(res, statusCode, JSON.stringify(payload, null, 2), "application/json; charset=utf-8");
}

function respondText(res, statusCode, payload, contentType) {
  res.writeHead(statusCode, { "Content-Type": contentType });
  res.end(payload);
}

function respondBinary(res, statusCode, payload, contentType) {
  res.writeHead(statusCode, { "Content-Type": contentType });
  res.end(payload);
}
