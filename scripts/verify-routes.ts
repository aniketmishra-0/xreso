import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, "src", "app");
const SOURCE_DIR = path.join(ROOT, "src");

const FILE_EXTENSIONS = new Set([".ts", ".tsx"]);
const STATIC_ASSET_PREFIXES = ["/uploads/", "/thumbnails/", "/placeholder", "/icon", "/apple-icon"];

function walkFiles(dirPath: string): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const out: string[] = [];

  for (const entry of entries) {
    const absolute = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(absolute));
      continue;
    }

    if (FILE_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(absolute);
    }
  }

  return out;
}

function segmentToRegex(segment: string): string {
  if (segment.startsWith("[[...") && segment.endsWith("]]")) {
    return "(?:/(?:.+))?";
  }

  if (segment.startsWith("[...") && segment.endsWith("]")) {
    return "/.+";
  }

  if (segment.startsWith("[") && segment.endsWith("]")) {
    return "/[^/]+";
  }

  return `/${segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`;
}

function appPageToRouteRegex(filePath: string): RegExp {
  const relative = path.relative(APP_DIR, filePath).split(path.sep).join("/");
  const routeDir = path.posix.dirname(relative);
  const segments = routeDir === "." ? [] : routeDir.split("/");

  if (segments.length === 0) {
    return /^\/$/;
  }

  const pattern = "^" + segments.map(segmentToRegex).join("") + "$";
  return new RegExp(pattern);
}

function collectRouteRegexes(): RegExp[] {
  const pageFiles = walkFiles(APP_DIR).filter((filePath) => filePath.endsWith("/page.tsx"));
  return pageFiles.map(appPageToRouteRegex);
}

function extractInternalPaths(source: string): string[] {
  const found: string[] = [];

  const patterns = [
    /href\s*=\s*["'`]([^"'`]+)["'`]/g,
    /router\.(?:push|replace|prefetch)\(\s*["'`]([^"'`]+)["'`]/g,
    /fetch\(\s*["'`]([^"'`]+)["'`]/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null = null;
    while ((match = pattern.exec(source)) !== null) {
      found.push(match[1]);
    }
  }

  return found;
}

function normalizePath(candidate: string): string | null {
  if (!candidate.startsWith("/")) return null;
  if (candidate.startsWith("//")) return null;
  if (candidate.startsWith("/api/")) return null;

  for (const prefix of STATIC_ASSET_PREFIXES) {
    if (candidate.startsWith(prefix)) {
      return null;
    }
  }

  const [withoutQuery] = candidate.split("?");
  const [withoutHash] = withoutQuery.split("#");
  return withoutHash || "/";
}

function main() {
  const routeRegexes = collectRouteRegexes();
  const sourceFiles = walkFiles(SOURCE_DIR);

  const missingRoutes = new Map<string, string[]>();

  for (const filePath of sourceFiles) {
    const content = fs.readFileSync(filePath, "utf-8");
    const rawPaths = extractInternalPaths(content);

    for (const rawPath of rawPaths) {
      const normalized = normalizePath(rawPath);
      if (!normalized) continue;

      const matchesKnownRoute = routeRegexes.some((regex) => regex.test(normalized));
      if (matchesKnownRoute) continue;

      const rel = path.relative(ROOT, filePath);
      const existing = missingRoutes.get(normalized) || [];
      existing.push(rel);
      missingRoutes.set(normalized, existing);
    }
  }

  if (missingRoutes.size > 0) {
    console.error("Route verification failed. Missing pages referenced in source:");
    for (const [route, files] of missingRoutes.entries()) {
      console.error(`- ${route}`);
      for (const filePath of files) {
        console.error(`  referenced in ${filePath}`);
      }
    }
    process.exit(1);
  }

  console.log("Route verification passed. No broken internal page links were detected.");
}

main();
