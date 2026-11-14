#!/usr/bin/env node
// Select the linux/amd64 image manifest out of the content that
// `scripts/pin-images.sh` finds in nexus's containerd store for quill-search.
//
// quill-search has no Dockerfile in this repo. The pinned content is an OCI
// image index produced by an older docker build, and that build attached
// BuildKit provenance/SBOM attestations as an extra `unknown/unknown`
// manifest whose config blob (`sha256:44136fa3…`, literally `{}`) was never
// imported into the store. The index cannot be pushed: containerd walks it,
// asks for the missing blob, and dies with
//
//   ctr: content digest sha256:e7d884da…: not found
//
// `ctr images push --platform linux/amd64` does not help either — containerd
// still uploads the original index and registry:2 rejects it with
// `400 … manifest list/index references to blobs and/or manifests are
// missing` (verified against registry:2 on nexus, 2026-11-04).
//
// The amd64 child manifest, its config, and its layers are all present, so
// this module picks that child and rewrites the index down to a single entry.
// The shell stages that as a one-image OCI archive, imports it (which creates
// an image whose target is a manifest, not an index) and pushes the manifest.
// Every blob the registry receives is then one the manifest references.
//
//   node scripts/gates/oci-image-manifest.mjs \
//     --platform linux/amd64 \
//     --ref-prefix docker.io/library/quill-search-amd64 \
//     --digest sha256:<pinned> \
//     --index-out /tmp/stage/index.json < content.json
//
// Reads the pinned content JSON on stdin and prints the manifest digest it
// selected. The caller fetches that blob from the content store.

import { readFileSync, writeFileSync } from 'node:fs';

export const DEFAULT_PLATFORM = 'linux/amd64';
export const OCI_INDEX_MEDIA_TYPE = 'application/vnd.oci.image.index.v1+json';
export const OCI_MANIFEST_MEDIA_TYPE = 'application/vnd.oci.image.manifest.v1+json';

/**
 * BuildKit attestations show up as `unknown/unknown` manifests (some docker
 * versions additionally annotate them with
 * `vnd.docker.reference.type: attestation-manifest`). They are not runnable
 * images and their blobs may be absent.
 */
export function isAttestationManifest(descriptor) {
  if (!descriptor || typeof descriptor !== 'object') return true;
  const annotations = descriptor.annotations ?? {};
  if (annotations['vnd.docker.reference.type'] === 'attestation-manifest') return true;
  return descriptor.platform?.os === 'unknown' && descriptor.platform?.architecture === 'unknown';
}

function parsePlatform(platform) {
  const [os, architecture, ...rest] = String(platform ?? '').split('/');
  if (!os || !architecture || rest.length) {
    throw new Error(`platform must be os/arch (got '${platform}')`);
  }
  return { os, architecture };
}

/**
 * Given the pinned content document, return the single image manifest to push.
 *
 * - an image index / manifest list: the one non-attestation entry for
 *   `platform`, with its digest, size and media type;
 * - an image manifest: the document itself (`digest`/`size` are supplied by
 *   the caller, which read the blob from the store).
 *
 * @param {unknown} doc parsed content JSON
 * @param {string} platform os/arch, default linux/amd64
 * @returns {{kind: 'index-child'|'manifest', digest: string|null, size: number|null, mediaType: string}}
 */
export function selectPlatformManifest(doc, platform = DEFAULT_PLATFORM) {
  const { os, architecture } = parsePlatform(platform);
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new Error('content is not a JSON object');
  }
  const manifests = Array.isArray(doc.manifests) ? doc.manifests : null;
  if (!manifests) {
    if (!doc.config?.digest || !Array.isArray(doc.layers)) {
      throw new Error(`content is not an image index or image manifest (mediaType ${doc.mediaType ?? '<none>'})`);
    }
    return {
      kind: 'manifest',
      digest: null,
      size: null,
      mediaType: doc.mediaType || OCI_MANIFEST_MEDIA_TYPE,
    };
  }
  const matches = manifests.filter(
    (entry) => !isAttestationManifest(entry) && entry.platform?.os === os && entry.platform?.architecture === architecture,
  );
  if (matches.length === 0) {
    const seen = manifests
      .filter((entry) => !isAttestationManifest(entry))
      .map((entry) => `${entry.platform?.os ?? '?'}/${entry.platform?.architecture ?? '?'}`)
      .join(', ');
    throw new Error(`index has no ${platform} manifest (has: ${seen || 'none'})`);
  }
  if (matches.length > 1) {
    throw new Error(`index lists ${matches.length} ${platform} manifests; refusing to guess`);
  }
  const match = matches[0];
  if (!/^sha256:[0-9a-f]{64}$/.test(String(match.digest))) {
    throw new Error(`index child manifest digest is not sha256: ${match.digest ?? '<missing>'}`);
  }
  const size = Number(match.size);
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error(`index child manifest size is invalid: ${match.size}`);
  }
  return {
    kind: 'index-child',
    digest: match.digest,
    size,
    mediaType: match.mediaType || OCI_MANIFEST_MEDIA_TYPE,
  };
}

/** Image name for the staged single-manifest import. Stable per manifest, so
 * the content stays referenced in the store for the next deploy. */
export function stagedImageName(refPrefix, digest) {
  if (!/^sha256:[0-9a-f]{64}$/.test(String(digest))) {
    throw new Error(`staged image digest is not sha256: ${digest}`);
  }
  return `${refPrefix}:${digest.slice('sha256:'.length)}`;
}

/**
 * OCI layout index.json with exactly one entry: the manifest to push.
 * containerd's `images import` reads the ref name from this annotation.
 */
export function singleManifestIndex(descriptor, refName, platform = DEFAULT_PLATFORM) {
  const { os, architecture } = parsePlatform(platform);
  if (!descriptor || !/^sha256:[0-9a-f]{64}$/.test(String(descriptor.digest))) {
    throw new Error(`descriptor digest is not sha256: ${descriptor?.digest ?? '<missing>'}`);
  }
  const size = Number(descriptor.size);
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error(`descriptor size is invalid: ${descriptor?.size ?? '<missing>'}`);
  }
  if (!refName) throw new Error('refName is required');
  return {
    schemaVersion: 2,
    mediaType: OCI_INDEX_MEDIA_TYPE,
    manifests: [
      {
        mediaType: descriptor.mediaType || OCI_MANIFEST_MEDIA_TYPE,
        digest: descriptor.digest,
        size,
        platform: { architecture, os },
        annotations: { 'org.opencontainers.image.ref.name': refName },
      },
    ],
  };
}

function argValue(argv, flag) {
  const i = argv.indexOf(flag);
  if (i === -1) return null;
  return argv[i + 1] ?? '';
}

function main(argv) {
  const platform = argValue(argv, '--platform') || DEFAULT_PLATFORM;
  const refPrefix = argValue(argv, '--ref-prefix');
  const pinnedDigest = argValue(argv, '--digest');
  const indexOut = argValue(argv, '--index-out');
  if (!refPrefix || !pinnedDigest || !indexOut) {
    console.error(
      'oci-image-manifest: usage: --ref-prefix <repo> --digest <sha256:…> --index-out <path> [--platform os/arch] < content.json',
    );
    return 2;
  }

  const raw = readStdin();
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch (err) {
    console.error(`oci-image-manifest: pinned content is not JSON: ${err.message}`);
    return 1;
  }

  let selected;
  try {
    selected = selectPlatformManifest(doc, platform);
    if (selected.kind === 'manifest') {
      selected = { ...selected, digest: pinnedDigest, size: Buffer.byteLength(raw, 'utf8') };
    }
    const refName = stagedImageName(refPrefix, selected.digest);
    const index = singleManifestIndex(selected, refName, platform);
    writeFileSync(indexOut, `${JSON.stringify(index)}\n`);
  } catch (err) {
    console.error(`oci-image-manifest: ${err.message}`);
    return 1;
  }

  process.stdout.write(`${selected.digest}\n`);
  return 0;
}

function readStdin() {
  return readFileSync(0, 'utf8');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
