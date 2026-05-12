#!/usr/bin/env python3
"""Validate all K8s YAML manifests in the civint-mcp directory."""
import yaml, sys, os

k8s_dir = "/data/projects/own/frostbite-data-pipeline/packages/mcp-server/k8s"
files = ["deployment.yaml", "service.yaml", "ingress.yaml", "secret.yaml"]
all_ok = True

for fname in files:
    path = os.path.join(k8s_dir, fname)
    print(f"\n─── {fname} ───")
    with open(path) as f:
        try:
            docs = list(yaml.safe_load_all(f))
            for i, doc in enumerate(docs):
                if doc is None:
                    continue
                kind = doc.get("kind", "?")
                api = doc.get("apiVersion", "?")
                name = doc.get("metadata", {}).get("name", "?")
                ns = doc.get("metadata", {}).get("namespace", "default")
                print(f"  [{i}] kind={kind}, apiVersion={api}, name={name}, ns={ns}")
                
                # Generic checks
                assert doc.get("apiVersion"), f"missing apiVersion"
                assert doc.get("kind"), f"missing kind"
                assert doc.get("metadata", {}).get("name"), f"missing metadata.name"
                
                # Deployment
                if kind == "Deployment":
                    spec = doc.get("spec", {})
                    assert spec.get("replicas", 0) == 1, f"replicas should be 1"
                    assert spec.get("selector", {}).get("matchLabels"), f"missing selector"
                    tmpl = spec.get("template", {})
                    c = tmpl.get("spec", {}).get("containers", [{}])[0]
                    assert c.get("ports"), f"missing ports"
                    assert c.get("livenessProbe"), f"missing livenessProbe"
                    assert c.get("readinessProbe"), f"missing readinessProbe"
                    assert c.get("resources", {}).get("requests"), f"missing resource requests"
                    assert c.get("resources", {}).get("limits"), f"missing resource limits"
                    print(f"  Container: {c.get('name')}, image={c.get('image')}")
                    print(f"  Requests: {c['resources']['requests']}")
                    print(f"  Limits: {c['resources']['limits']}")
                    print(f"  Probes: liveness={c['livenessProbe']['httpGet']['path']}, readiness={c['readinessProbe']['httpGet']['path']}")
                    
                    # Verify labels match selector
                    sel = spec["selector"]["matchLabels"]
                    tmpl_labels = tmpl.get("metadata", {}).get("labels", {})
                    for k, v in sel.items():
                        assert tmpl_labels.get(k) == v, f"template label {k}={v} doesn't match selector"
                    print(f"  Selector/Template labels match ✓")
                
                # Service
                if kind == "Service":
                    spec = doc.get("spec", {})
                    assert spec.get("type") == "ClusterIP", f"should be ClusterIP"
                    assert len(spec.get("ports", [])) > 0, f"missing ports"
                    port = spec["ports"][0]
                    print(f"  Port: {port['port']} → {port['targetPort']} ({port.get('name','?')})")
                    print(f"  Selector: {spec['selector']}")
                
                # Ingress
                if kind == "Ingress":
                    spec = doc.get("spec", {})
                    assert spec.get("rules"), f"missing rules"
                    assert spec.get("tls"), f"missing tls"
                    host = spec["rules"][0].get("host", "?")
                    print(f"  Host: {host}")
                    print(f"  TLS secret: {spec['tls'][0].get('secretName','?')}")
                    print(f"  Class: {spec.get('ingressClassName','?')}")
                
                # Secret
                if kind == "Secret":
                    assert doc.get("type") == "Opaque", f"wrong type"
                    assert doc.get("stringData"), f"missing stringData"
                    for k in doc["stringData"]:
                        print(f"  Key: {k}")
            
            valid_count = len([d for d in docs if d])
            print(f"  ✓ VALID ({valid_count} doc(s))")
        except yaml.YAMLError as e:
            print(f"  ✗ YAML ERROR: {e}")
            all_ok = False
        except AssertionError as e:
            print(f"  ✗ STRUCTURE ERROR: {e}")
            all_ok = False

print(f"\n{'='*60}")
print(f"OVERALL: {'ALL VALID' if all_ok else 'SOME FAILED'}")
print(f"{'='*60}")
sys.exit(0 if all_ok else 1)
