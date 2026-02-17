#!/usr/bin/env node
/**
 * Upload Cloak release artifacts from src-tauri/target/release/bundle/ to Supabase Storage.
 *
 * Required env:
 *   SUPABASE_URL              - e.g. https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key (or anon key if bucket allows uploads)
 *
 * Optional env:
 *   SUPABASE_BUCKET           - Bucket name (default: cloak-releases)
 *   CLOAK_VERSION             - Override version folder (default: from package.json)
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/upload-cloak-to-supabase.mjs
 *   make upload-supabase   # same, with env from .env
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..");
const bundleDir = join(root, "src-tauri", "target", "release", "bundle");

const REQUIRED_EXT = [".dmg", ".msi", ".exe", ".deb", ".rpm", ".AppImage"];
const version =
	process.env.CLOAK_VERSION ||
	JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const bucket = process.env.SUPABASE_BUCKET || "cloak-releases";

function findArtifacts(dir, base = dir) {
	const out = [];
	const entries = readdirSync(dir, { withFileTypes: true });
	for (const e of entries) {
		const full = join(dir, e.name);
		if (e.isDirectory()) {
			out.push(...findArtifacts(full, base));
		} else if (e.isFile() && REQUIRED_EXT.some((ext) => e.name.endsWith(ext))) {
			out.push(full);
		}
	}
	return out;
}

async function main() {
	const url = process.env.SUPABASE_URL;
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

	if (!url || !key) {
		console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY).");
		console.error("Set them in the environment or in a .env file (load with dotenv if needed).");
		process.exit(1);
	}

	try {
		if (!statSync(bundleDir).isDirectory()) throw new Error("not a directory");
	} catch {
		console.error("Bundle directory not found. Run 'make build' (or build-macos-arm64, etc.) first.");
		process.exit(1);
	}

	const files = findArtifacts(bundleDir);
	if (files.length === 0) {
		console.error("No installer artifacts found under", bundleDir);
		console.error("Expected extensions:", REQUIRED_EXT.join(", "));
		process.exit(1);
	}

	const supabase = createClient(url, key, { auth: { persistSession: false } });

	const prefix = `v${version}`;

	// Ensure bucket exists (create if missing; requires service role key for creation)
	const { data: buckets } = await supabase.storage.listBuckets();
	const bucketExists = buckets?.some((b) => b.name === bucket);
	if (!bucketExists) {
		console.log(`Bucket "${bucket}" not found. Creating...`);
		const { error: createErr } = await supabase.storage.createBucket(bucket, {
			public: true,
		});
		if (createErr) {
			console.error(
				"Could not create bucket:",
				createErr.message,
				"\nCreate the bucket in Supabase Dashboard: Storage → New bucket → name:",
				bucket,
				"→ Public. Or use SUPABASE_SERVICE_ROLE_KEY for uploads."
			);
			process.exit(1);
		}
		console.log("  Bucket created.");
	}

	console.log(`Uploading ${files.length} file(s) to bucket "${bucket}" under ${prefix}/ ...`);

	for (const filePath of files) {
		const fileName = relative(bundleDir, filePath).replace(/\\/g, "/");
		const objectPath = `${prefix}/${fileName}`;
		const body = readFileSync(filePath);
		const { data, error } = await supabase.storage
			.from(bucket)
			.upload(objectPath, body, {
				contentType: "application/octet-stream",
				upsert: true,
			});

		if (error) {
			console.error(`Failed to upload ${fileName}:`, error.message);
			process.exit(1);
		}
		console.log("  OK", objectPath);
	}

	const base = url.replace(/\/$/, "");
	const publicBase = `${base}/storage/v1/object/public/${bucket}`;
	console.log("\nDone. Public URLs (if bucket is public):");
	for (const filePath of files) {
		const fileName = relative(bundleDir, filePath).replace(/\\/g, "/");
		console.log("  ", `${publicBase}/${prefix}/${fileName}`);
	}
}

main();
