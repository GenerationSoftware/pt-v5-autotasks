import esMain from 'es-main';
import figlet from 'figlet';
import chalk from 'chalk';
import { ethers } from 'ethers';
import {
  instantiateRelayerAccount,
  PrizeClaimerEnvVars,
  PrizeClaimerConfig,
  RelayerAccount,
} from '@generationsoftware/pt-v5-autotasks-library';

import { executeTransactions } from './executeTransactions';
import { loadPrizeClaimerEnvVars } from './loadPrizeClaimerEnvVars';

console.log(chalk.magenta(figlet.textSync('PoolTogether')));
console.log(chalk.blue(figlet.textSync('Prize Claim Bot')));

if (esMain(import.meta)) {
  const envVars: PrizeClaimerEnvVars = loadPrizeClaimerEnvVars();

  const provider = new ethers.providers.JsonRpcProvider(envVars.JSON_RPC_URI, envVars.CHAIN_ID);

  const mockEvent = {
    apiKey: envVars.RELAYER_API_KEY,
    apiSecret: envVars.RELAYER_API_SECRET,
  };

  const relayerAccount: RelayerAccount = await instantiateRelayerAccount(
    provider,
    mockEvent,
    envVars.CUSTOM_RELAYER_PRIVATE_KEY,
  );

  const config: PrizeClaimerConfig = {
    ...relayerAccount,
    provider,
    chainId: envVars.CHAIN_ID,
    rewardRecipient: envVars.REWARD_RECIPIENT,
    useFlashbots: envVars.USE_FLASHBOTS,
    minProfitThresholdUsd: Number(envVars.MIN_PROFIT_THRESHOLD_USD),
    covalentApiKey: envVars.COVALENT_API_KEY,
  };

  await executeTransactions(config);
}

export function main() {}
