import { Contract, PopulatedTransaction } from '@ethersproject/contracts';
import { ContractsBlob, getContracts } from '@generationsoftware/pt-v5-utils-js';
import { YieldVaultMintRateConfig } from './types';
import { getGasPrice } from './utils';
import { sendPopulatedTx } from './helpers/sendPopulatedTx';

export async function runYieldVaultMintRate(
  contracts: ContractsBlob,
  params: YieldVaultMintRateConfig,
): Promise<void> {
  const { chainId, ozRelayer, wallet, readProvider } = params;

  const yieldVaultContracts: Contract[] = getContracts(
    'YieldVault',
    chainId,
    readProvider,
    contracts,
  );

  for (const yieldVaultContract of yieldVaultContracts) {
    if (!yieldVaultContract) {
      throw new Error('YieldVault: Contract Unavailable');
    }
    const populatedTx: PopulatedTransaction = await yieldVaultContract.populateTransaction.mintRate();

    try {
      const gasLimit = 200000;
      const { gasPrice } = await getGasPrice(readProvider);
      console.log(`YieldVault: mintRate() ${yieldVaultContract.address}`);
      const tx = await sendPopulatedTx(ozRelayer, wallet, populatedTx, gasLimit, gasPrice);
      console.log('TransactionHash:', tx.hash);
      console.log('');
    } catch (error) {
      throw new Error(error);
    }
  }
}