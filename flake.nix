{
  description = "Frostbite Data Pipeline — Canadian sovereign data ingestion, curation, verification, and audit for civic intelligence";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }: {
    # Source is available as self.outPath for consumption by nixos-config
    # The civint-mcp-image OCI package lives in nixos-config's packages/
    # which has the dockerTools/buildEnv infrastructure.
  };
}
