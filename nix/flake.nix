{
    description = "Standalone nftables reload systemd timer";

    inputs.nixpkgs.url = "github:NixOS/nixpkgs";

    outputs = { self, nixpkgs }:
    let
    systems = [ "x86_64-linux" "aarch64-linux" ];
        in
    nixpkgs.lib.genAttrs systems (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        packages.default = pkgs.callPackage ./nix/default.nix {};
      }
    );
}
