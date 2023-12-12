import esMain from 'es-main';
import figlet from 'figlet';
import chalk from 'chalk';
import yn from 'yn';
import { ethers } from 'ethers';
import {
  instantiateRelayerAccount,
  DrawAuctionConfig,
  RelayerAccount,
  DrawAuctionEnvVars,
} from '@generationsoftware/pt-v5-autotasks-library';
import { DefenderRelayProvider } from 'defender-relay-client/lib/ethers';

import { executeTransactions } from './transactions';
import { loadEnvVars } from './loadEnvVars';

console.log(chalk.magenta(figlet.textSync('PoolTogether')));
console.log(chalk.blue(figlet.textSync('Draw Auction Bot')));

if (esMain(import.meta)) {
  const envVars: DrawAuctionEnvVars = loadEnvVars();

  const l1Provider = new ethers.providers.JsonRpcProvider(
    envVars.JSON_RPC_URI, // is RNG chain RPC URI
    Number(envVars.CHAIN_ID), // is RNG chain ID
  );

  const mockEvent = {
    apiKey: envVars.RELAYER_API_KEY, // RNG chain OZ relayer API Key
    apiSecret: envVars.RELAYER_API_SECRET, // RNG chain OZ relayer API secret
  };
  const rngWriteProvider = new DefenderRelayProvider(mockEvent);

  const relayerAccount: RelayerAccount = await instantiateRelayerAccount(
    rngWriteProvider,
    l1Provider,
    mockEvent,
    envVars.CUSTOM_RELAYER_PRIVATE_KEY,
  );

  const drawAuctionConfig: DrawAuctionConfig = {
    l1ChainId: Number(envVars.CHAIN_ID),
    l1Provider: l1Provider,
    covalentApiKey: envVars.COVALENT_API_KEY,
    useFlashbots: yn(envVars.USE_FLASHBOTS),
    rewardRecipient: envVars.REWARD_RECIPIENT,
    minProfitThresholdUsd: Number(envVars.MIN_PROFIT_THRESHOLD_USD),

    customRelayerPrivateKey: process.env.CUSTOM_RELAYER_PRIVATE_KEY,

    relayerApiKey: process.env.RELAYER_API_KEY,
    relayerApiSecret: process.env.RELAYER_API_SECRET,

    relayChainIds: process.env.RELAY_CHAIN_IDS.split(',').map((chainId) => Number(chainId)),
    arbitrumRelayJsonRpcUri: process.env.ARBITRUM_JSON_RPC_URI,
    optimismRelayJsonRpcUri: process.env.OPTIMISM_JSON_RPC_URI,
    arbitrumSepoliaRelayJsonRpcUri: process.env.ARBITRUM_SEPOLIA_JSON_RPC_URI,
    optimismSepoliaRelayJsonRpcUri: process.env.OPTIMISM_SEPOLIA_JSON_RPC_URI,

    signer: relayerAccount.signer,
    rngWallet: relayerAccount.wallet,
    rngOzRelayer: relayerAccount.ozRelayer,
    rngRelayerAddress: relayerAccount.relayerAddress,
  };

  await executeTransactions(drawAuctionConfig);
}

export function main() {}
