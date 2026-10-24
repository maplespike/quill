#!/usr/bin/env python3
"""MapleSpike Qdrant Indexer - no external dependencies"""
import argparse, hashlib, json, os, struct, sys, time, urllib.request, urllib.error
from pathlib import Path

def http_json(url, method="GET", data=None, headers=None):
    req = urllib.request.Request(url, method=method)
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    req.add_header("Content-Type", "application/json")
    if data is not None:
        req.data = json.dumps(data).encode()
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"status": "error", "detail": str(e)}

QDRANT_URL = os.environ.get("QDRANT_URL", "http://localhost:6333")

def embed_text(text):
    h = hashlib.sha256(text.encode()).digest()
    vec = []
    for i in range(0, min(32, 128 * 4), 4):
        if i + 4 <= len(h):
            val = struct.unpack(">I", h[i:i+4])[0]
            vec.append((val % 20000) / 20000.0 - 0.5)
    while len(vec) < 128:
        vec.append(0.0)
    mag = sum(x*x for x in vec) ** 0.5
    if mag > 0:
        vec = [x/mag for x in vec]
    return vec[:128]

SEED_DATA = [
    {"id": "seed::1", "title": "House of Commons FINA Committee", "description": "Standing Committee on Finance - hearings on budget, taxation, banking", "source": "Parliament of Canada", "type": "committee"},
    {"id": "seed::2", "title": "Federal Lobbying Registry", "description": "Federal lobbying registrations, monthly communication reports", "source": "Office of the Commissioner of Lobbying", "type": "lobbying"},
    {"id": "seed::3", "title": "Canada Gazette Part I", "description": "Government notices, proposed regulations, public consultations", "source": "Government of Canada", "type": "regulatory"},
    {"id": "seed::4", "title": "SEDI Insider Trading", "description": "Senior insider share transactions reported to SEDI", "source": "Canadian Securities Administrators", "type": "corporate"},
    {"id": "seed::5", "title": "Ontario Lobbyists Registry", "description": "Ontario lobbying registrations and monthly communication reports", "source": "Ontario Office of the Integrity Commissioner", "type": "lobbying"},
    {"id": "seed::6", "title": "BC Assessment Property Values", "description": "BC Assessment property valuations and descriptions", "source": "BC Data Catalogue", "type": "property"},
    {"id": "seed::7", "title": "TTC Bus Delay Data", "description": "Toronto Transit Commission bus delay data from Toronto Open Data", "source": "Toronto Open Data CKAN", "type": "transit"},
    {"id": "seed::8", "title": "Quebec Lobby Register", "description": "Quebec lobbyist registrations and communications", "source": "Communaute de lobby.quebec", "type": "lobbying"},
]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--module", "-m", help="Module filter")
    args = parser.parse_args()

    records = SEED_DATA
    print(f"Indexing {len(records)} records to Qdrant collection 'maplespike'")
    points = []
    for rec in records:
        text = f"{rec.get('title', '')} {rec.get('description', '')}"
        vector = embed_text(text)
        points.append({
            "id": abs(hash(rec["id"])) % (2**63),
            "vector": vector,
            "payload": rec
        })
    url = f"{QDRANT_URL}/collections/maplespike/points?wait=true"
    result = http_json(url, method="PUT", data={"points": points})
    print(f"Result: {result.get('status', 'ok')}")

    count_url = f"{QDRANT_URL}/collections/maplespike"
    info = http_json(count_url)
    count = info.get("result", {}).get("points_count", 0)
    print(f"Collection now has {count} points")

if __name__ == "__main__":
    main()
