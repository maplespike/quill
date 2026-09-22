G1: quill-mcp handler suite runs hermetically (mock intercepts every upstream call, zero pass-throughs)  |  CHECK: bash scripts/gates-run.sh G1  |  EXPECT: G1 PASS  |  TIMEOUT: 420
G2: municipal candidate validator rejects the known-bad fixtures (Winnipeg/Edmonton) and accepts known-good ones  |  CHECK: bash scripts/gates-run.sh G2  |  EXPECT: G2 PASS  |  TIMEOUT: 300
G3: refreshed municipal registry carries validated entries (topic-fit name + probed rows) for the four flagged keys  |  CHECK: bash scripts/gates-run.sh G3  |  EXPECT: G3 PASS  |  TIMEOUT: 900
G4: StatCan WDS verified healthy with the correct HTTP methods and a WDS probe is wired into the health check  |  CHECK: bash scripts/gates-run.sh G4  |  EXPECT: G4 PASS  |  TIMEOUT: 180
G5: onboarding psychology audit artifact exists with live-flow evidence and actionable sections  |  CHECK: bash scripts/gates-run.sh G5  |  EXPECT: G5 PASS  |  TIMEOUT: 120
