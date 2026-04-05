import "dotenv/config";
import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { defineConfig } from "hardhat/config";

const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL || "";
const sepoliaPrivateKey = process.env.SEPOLIA_PRIVATE_KEY || "";

function normalizePrivateKey(value: string): string {
  const trimmed = value.trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return prefixed;
}

const normalizedSepoliaPrivateKey = normalizePrivateKey(sepoliaPrivateKey);

if (normalizedSepoliaPrivateKey && !/^0x[a-fA-F0-9]{64}$/.test(normalizedSepoliaPrivateKey)) {
  throw new Error(
    "Invalid SEPOLIA_PRIVATE_KEY format. It must be a wallet private key (64 hex chars), not a wallet address."
  );
}

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: sepoliaRpcUrl,
      accounts: normalizedSepoliaPrivateKey ? [normalizedSepoliaPrivateKey] : [],
    },
  },
});
