{ lib, stdenv, nftables }:

stdenv.mkDerivation {
  name = "nftables-reload-timer";

  src = ./systemd;

  dontBuild = true;

  installPhase = ''
    mkdir -p $out/lib/systemd/system

    substitute nft-reload.service \
      $out/lib/systemd/system/nft-reload.service \
      --replace @nft@ ${nftables}

    install -m644 nft-reload.timer \
      $out/lib/systemd/system/nft-reload.timer
  '';
}