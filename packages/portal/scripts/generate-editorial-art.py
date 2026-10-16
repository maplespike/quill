"""Generate decorative Quill artwork with the operator's local ComfyUI instance.

Run from packages/portal. Requires only Python's standard library.
The output is an illustration, not a map, chart, or source document.
"""
import json
import os
from pathlib import Path
import time
import urllib.parse
import urllib.request

HOST = os.environ.get("COMFYUI_HOST", "http://127.0.0.1:32188")
PROMPT = (
    "Editorial architectural still life, a sculptural archive of Canadian public records, "
    "ivory paper sheets folded into abstract mountain ridges, one small deep vermilion "
    "red circular sun, fine black engraved contour lines, tactile uncoated cream paper, "
    "Swiss modernist art direction, museum print, restrained monochrome palette, "
    "warm soft side light, quiet and precise, generous negative space, overhead view, "
    "beautiful subtle paper grain, no lettering, no typography, no words"
)
NEGATIVE = "text, letters, words, watermark, logo, neon, purple, blue, glossy, plastic, busy, blurry, flag, people"
WORKFLOW = {
    "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "epicrealismXL_pureFix.safetensors"}},
    "2": {"class_type": "CLIPTextEncode", "inputs": {"text": PROMPT, "clip": ["1", 1]}},
    "3": {"class_type": "CLIPTextEncode", "inputs": {"text": NEGATIVE, "clip": ["1", 1]}},
    "4": {"class_type": "EmptyLatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
    "5": {"class_type": "KSampler", "inputs": {"model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0], "latent_image": ["4", 0], "seed": 10902026, "steps": 26, "cfg": 5.5, "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": 1}},
    "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
    "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": "quill-public-record-1090"}},
}


def request(path, payload=None):
    body = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(HOST + path, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)


def main():
    result = request("/prompt", {"prompt": WORKFLOW, "client_id": "quill-design-1090"})
    prompt_id = result["prompt_id"]
    print("ComfyUI prompt:", prompt_id, flush=True)
    for _ in range(240):
        history = request("/history/" + prompt_id).get(prompt_id)
        if history:
            if history.get("status", {}).get("status_str") == "error":
                raise RuntimeError(json.dumps(history["status"]))
            images = history.get("outputs", {}).get("7", {}).get("images", [])
            if images:
                image = images[0]
                query = urllib.parse.urlencode(image)
                with urllib.request.urlopen(HOST + "/view?" + query, timeout=30) as response:
                    Path("/tmp/quill-public-record.png").write_bytes(response.read())
                metadata = {"purpose": "Decorative AI illustration. Not a map, source record, or data visualisation.", "model": WORKFLOW["1"]["inputs"]["ckpt_name"], "prompt": PROMPT, "negative_prompt": NEGATIVE, "seed": 10902026, "workflow": WORKFLOW, "prompt_id": prompt_id}
                Path("public/assets/public-record-art.json").write_text(json.dumps(metadata, indent=2) + "\n")
                print("Saved /tmp/quill-public-record.png and artwork provenance.", flush=True)
                return
        time.sleep(3)
    raise TimeoutError("ComfyUI did not finish within 12 minutes; no artwork saved")


if __name__ == "__main__":
    main()
