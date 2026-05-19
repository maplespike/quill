#!/usr/bin/env python3
"""
MapleSpike — Check Image Digest Drift
Compares current upstream digests against pinned digests in k8s/images.json
Outputs DRIFT if any image has a different digest upstream.
"""

import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime

IMAGES_JSON = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "k8s", "images.json")


def get_docker_hub_token(scope: str) -> str:
    """Get auth token for Docker Hub."""
    url = f"https://auth.docker.io/token?service=registry.docker.io&scope=repository:{scope}:pull"
    with urllib.request.urlopen(url, timeout=15) as resp:
        data = json.loads(resp.read())
        return data["token"]


def get_ghcr_token(scope: str) -> str:
    """Get auth token for GHCR."""
    url = f"https://ghcr.io/token?service=ghcr.io&scope=repository:{scope}:pull"
    with urllib.request.urlopen(url, timeout=15) as resp:
        data = json.loads(resp.read())
        return data["token"]


def resolve_docker_hub_digest(image: str, tag: str) -> str:
    """Resolve digest for a Docker Hub image."""
    token = get_docker_hub_token(image)
    req = urllib.request.Request(
        f"https://registry-1.docker.io/v2/{image}/manifests/{tag}",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.docker.distribution.manifest.list.v2+json",
        },
        method="HEAD",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.headers.get("Docker-Content-Digest", "")


def resolve_ghcr_digest(image: str, tag: str) -> str:
    """Resolve digest for a GHCR image."""
    token = get_ghcr_token(image)
    req = urllib.request.Request(
        f"https://ghcr.io/v2/{image}/manifests/{tag}",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.docker.distribution.manifest.list.v2+json",
        },
        method="HEAD",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.headers.get("Docker-Content-Digest", "")


def check_drift():
    """Check all pinned images for digest drift."""
    with open(IMAGES_JSON) as f:
        data = json.load(f)

    drifted = []
    checked = 0
    errors = []

    # Check third-party images
    for key, entry in data.get("third_party", {}).items():
        image = entry["image"].replace("docker.io/", "").replace("docker.io/library/", "library/")
        tag = entry["tag"]
        pinned_digest = entry.get("digest", "")

        if not pinned_digest:
            errors.append(f"  {key}: no pinned digest")
            continue

        try:
            current_digest = resolve_docker_hub_digest(image, tag)
            checked += 1
            status = "OK" if current_digest == pinned_digest else "DRIFT"
            if status == "DRIFT":
                drifted.append({
                    "key": key,
                    "image": image,
                    "tag": tag,
                    "pinned": pinned_digest[:19] + "...",
                    "current": current_digest[:19] + "...",
                })
            print(f"  {key}: {image}:{tag} -> {status}")
        except Exception as e:
            errors.append(f"  {key}: {e}")

        # Rate limiting
        import time
        time.sleep(1)

    print()

    # Print summary
    print(f"Checked: {checked} images")
    print(f"Drifted: {len(drifted)} images")
    print(f"Errors:  {len(errors)} images")

    if drifted:
        print()
        print("DRIFT DETECTED:")
        for d in drifted:
            print(f"  {d['key']}: {d['image']}:{d['tag']}")
            print(f"    pinned:  {d['pinned']}")
            print(f"    current: {d['current']}")
        print()
        print("DRIFT")
        return 1

    if errors:
        print()
        print("Errors:")
        for e in errors:
            print(f"  {e}")

    return 0


if __name__ == "__main__":
    sys.exit(check_drift())
