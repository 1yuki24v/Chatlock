import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect({
    network: "sepolia",
    chainType: "l1",
  });

  console.log(`Deploying DecentralizedMessenger to sepolia...`);

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "ETH");

  const Messenger = await ethers.getContractFactory("DecentralizedMessenger");
  const messenger = await Messenger.deploy();
  await messenger.waitForDeployment();

  const address = await messenger.getAddress();
  console.log("DecentralizedMessenger deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

