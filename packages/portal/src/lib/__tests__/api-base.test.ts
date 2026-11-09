import { describe, expect, test } from "vitest";
import { deriveApiBase } from "../api-base";
import { discoveryCurl } from "../api-key-reveal";

describe("deriveApiBase", () => {
  test("strips a service subdomain and points at api.<apex>", () => {
    expect(deriveApiBase({ protocol: "https:", hostname: "quill.maplespike.ca" })).toBe("https://api.maplespike.ca");
    expect(deriveApiBase({ protocol: "https:", hostname: "portal.maplespike.ca" })).toBe("https://api.maplespike.ca");
    expect(deriveApiBase({ protocol: "https:", hostname: "www.maplespike.ca" })).toBe("https://api.maplespike.ca");
  });

  test("keeps a bare apex as-is", () => {
    expect(deriveApiBase({ protocol: "https:", hostname: "maplespike.ca" })).toBe("https://api.maplespike.ca");
  });

  test("keeps a deeper host that is not a service subdomain", () => {
    expect(deriveApiBase({ protocol: "https:", hostname: "research.example.org" })).toBe("https://api.research.example.org");
  });

  test("preserves the protocol and prefixes the LAN apex (docs/ROUTING.md)", () => {
    // The repo's routing doc is explicit: LAN access is quill.lan (portal) and
    // api.quill.lan (API). "quill.lan" is only two labels, so no service subdomain
    // is stripped and the api. prefix is added to the whole host.
    expect(deriveApiBase({ protocol: "http:", hostname: "quill.lan" })).toBe("http://api.quill.lan");
    expect(deriveApiBase({ protocol: "http:", hostname: "api.quill.lan" })).toBe("http://api.quill.lan");
  });

  test("an explicit apiBase wins and loses its trailing slash", () => {
    expect(deriveApiBase({ apiBase: "https://api.example.com/" })).toBe("https://api.example.com");
    expect(deriveApiBase({ apiBase: "https://api.example.com", hostname: "ignored.example" })).toBe("https://api.example.com");
  });

  test("an explicit apiBase drops a trailing /v1 so callers can add it once", () => {
    expect(deriveApiBase({ apiBase: "https://api.maplespike.ca/v1" })).toBe("https://api.maplespike.ca");
  });

  test("Cloudflare Pages hostnames call the public API", () => {
    expect(deriveApiBase({ protocol: "https:", hostname: "maplespike-quill.pages.dev" })).toBe("https://api.maplespike.ca");
    expect(deriveApiBase({ protocol: "https:", hostname: "preview.maplespike-quill.pages.dev" })).toBe("https://api.maplespike.ca");
  });

  test("falls back to the public API with no window", () => {
    expect(deriveApiBase({})).toBe("https://api.maplespike.ca");
  });
});

describe("discoveryCurl", () => {
  test("uses the full key against the free discovery endpoint", () => {
    const key = "qk_live_full_key_not_a_slice_0123456789";
    const curl = discoveryCurl("https://api.maplespike.ca/", key);
    expect(curl).toBe(`curl -s -H "x-api-key: ${key}" https://api.maplespike.ca/v1/llms.txt`);
    expect(curl).not.toContain("...");
  });
});
