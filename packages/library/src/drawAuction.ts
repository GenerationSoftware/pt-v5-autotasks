import chalk from 'chalk';
import { ethers, BigNumber, Contract, PopulatedTransaction } from 'ethers';
import { ContractsBlob, getContract } from '@generationsoftware/pt-v5-utils-js';

import { DrawAuctionContracts, DrawAuctionContext, DrawAuctionConfig } from './types';
import {
  logTable,
  logStringValue,
  logBigNumber,
  printAsterisks,
  printSpacer,
  getFeesUsd,
  roundTwoDecimalPlaces,
} from './utils';
import { chainName } from './utils/network';
import { NETWORK_NATIVE_TOKEN_INFO } from './constants/network';
import {
  getDrawAuctionContextMulticall,
  DrawAuctionState,
} from './utils/getDrawAuctionContextMulticall';
import { sendPopulatedTx } from './helpers/sendPopulatedTx';

type RngBlockhashStartDrawTxParams = {
  drawManagerAddress: string;
  rewardRecipient: string;
};

type RngWitnetStartDrawTxParams = {
  rngPaymentAmount: BigNumber;
  drawManagerAddress: string;
  rewardRecipient: string;
  value: BigNumber;
};

type FinishDrawTxParams = {
  rewardRecipient: string;
};

type StartDrawTransformedTxParams = {
  transformedTxParams: object;
  value: BigNumber;
};

const DRAW_GAS_LIMIT_BUFFER: number = 100000 as const;

/**
 * Main entry function - gets the current state of the DrawManager/RngWitnet
 * contracts and runs transactions if it's profitable.
 *
 * @returns {undefined} void function
 */
export async function runDrawAuction(
  contracts: ContractsBlob,
  config: DrawAuctionConfig,
): Promise<void> {
  const { chainId } = config;

  const drawAuctionContracts = instantiateDrawAuctionContracts(config, contracts);

  const context: DrawAuctionContext = await getDrawAuctionContextMulticall(
    config,
    drawAuctionContracts,
  );
  printContext(chainId, context);
  printSpacer();
  printSpacer();

  if (!context.drawAuctionState) {
    printAsterisks();
    console.log(chalk.yellow(`Currently no draw auctions to start or finish. Exiting ...`));
    printSpacer();
    return;
  }

  if (context.drawAuctionState === DrawAuctionState.Start) {
    console.log(chalk.green(`Processing 'Start Draw' for ${chainName(chainId)}:`));
    await checkStartDraw(config, context, drawAuctionContracts);
  } else if (context.drawAuctionState === DrawAuctionState.Finish) {
    console.log(chalk.green(`Processing 'Finish Draw' for ${chainName(chainId)}:`));
    await checkFinishDraw(config, context, drawAuctionContracts);
  }
}

/**
 * Pulls the contract data (abi, address, etc.) from the passed in ContractsBlob and instantiates
 * the contracts using ethers.js.
 *
 * @returns {DrawAuctionContracts} object representing the contracts we need to interact with for RNG draw auctions
 */
const instantiateDrawAuctionContracts = (
  config: DrawAuctionConfig,
  contracts: ContractsBlob,
): DrawAuctionContracts => {
  const { chainId, provider } = config;

  const version = {
    major: 1,
    minor: 0,
    patch: 0,
  };

  printSpacer();
  printSpacer();
  console.log(chalk.dim('Instantiating RNG contracts ...'));

  const prizePoolContract = getContract('PrizePool', chainId, provider, contracts, version);
  const drawManagerContract = getContract('DrawManager', chainId, provider, contracts, version);

  let rngWitnetContract, rngBlockhashContract;
  try {
    rngWitnetContract = getContract('RngWitnet', chainId, provider, contracts, version);
  } catch (e) {
    console.warn(chalk.yellow('Unable to find RngWitnet contract. Likely uses RngBlockhash'));
  }
  try {
    rngBlockhashContract = getContract('RngBlockhash', chainId, provider, contracts, version);
  } catch (e) {
    console.warn(chalk.yellow('Unable to find RngBlockhash contract. Likely uses RngWitnet'));
  }

  logTable({
    prizePoolContract: prizePoolContract.address,
    drawManagerContract: drawManagerContract.address,
    rngWitnetContract: rngWitnetContract?.address,
    rngBlockhashContract: rngBlockhashContract?.address,
  });

  return {
    prizePoolContract,
    drawManagerContract,
    rngWitnetContract,
    rngBlockhashContract,
  };
};

/**
 * Compares (gas cost + rng fee cost) against rewards profit estimation for the RngWitnet#startDraw() function.
 *
 * @param {DrawAuctionConfig} config, draw auction config
 * @param {DrawAuctionContext} context, current state of the draw auction contracts
 * @param {DrawAuctionContracts} drawAuctionContracts, ethers.js Contract instances of all rng auction contracts
 *
 * @returns {undefined} void function
 */
const checkStartDraw = async (
  config: DrawAuctionConfig,
  context: DrawAuctionContext,
  drawAuctionContracts: DrawAuctionContracts,
) => {
  const gasCostUsd = await getStartDrawGasCostUsd(config, context, drawAuctionContracts);
  if (gasCostUsd === 0) {
    printAsterisks();
    console.log(chalk.red('Gas cost is $0. Unable to determine profitability. Exiting ...'));
    return;
  }

  const profitable = await calculateStartDrawProfit(config, context, gasCostUsd);

  if (profitable) {
    await sendPopulatedStartDrawTransaction(config, context, drawAuctionContracts);
  } else {
    console.log(
      chalk.yellow(`Completing current auction currently not profitable. Try again soon ...`),
    );
  }
};

/**
 * Begins sending the RngWitnet#startDraw() payable function.
 *
 * @param {DrawAuctionConfig} config, draw auction config
 * @param {DrawAuctionContext} context, current state of the draw auction contracts
 * @param {DrawAuctionContracts} drawAuctionContracts, ethers.js Contract instances of all rng auction contracts
 *
 * @returns {undefined} void function
 */
const sendPopulatedStartDrawTransaction = async (
  config: DrawAuctionConfig,
  context: DrawAuctionContext,
  drawAuctionContracts: DrawAuctionContracts,
) => {
  const { chainId, ozRelayer, wallet, provider } = config;

  console.log(chalk.yellow(`Start Draw Transaction:`));
  console.log(chalk.green(`Execute rngWitnet#startDraw`));
  printSpacer();

  let contract: Contract = drawAuctionContracts.rngBlockhashContract;
  let txParams;
  let populatedTx: PopulatedTransaction;
  let estimatedGasLimit: BigNumber;
  if (drawAuctionContracts.rngWitnetContract) {
    contract = drawAuctionContracts.rngWitnetContract;

    txParams = buildRngWitnetStartDrawTxParams(config, context, drawAuctionContracts);

    estimatedGasLimit = await getStartDrawEstimatedGasLimit(
      drawAuctionContracts.rngWitnetContract,
      txParams,
    );

    const { value, transformedTxParams }: StartDrawTransformedTxParams =
      transformRngWitnetStartDrawTxParams(txParams);

    populatedTx = await contract.populateTransaction.startDraw(
      ...Object.values(transformedTxParams),
      { value },
    );
  } else {
    txParams = buildRngBlockhashStartDrawTxParams(config, drawAuctionContracts);

    estimatedGasLimit = await getStartDrawEstimatedGasLimit(
      drawAuctionContracts.rngBlockhashContract,
      txParams,
    );

    populatedTx = await contract.populateTransaction.startDraw(...Object.values(txParams));
  }

  console.log('estimatedGasLimit');
  console.log(estimatedGasLimit);
  console.log('estimatedGasLimit.toString()');
  console.log(estimatedGasLimit.toString());

  const estimatedGasLimitWithBufferAsNumber: number = Number(estimatedGasLimit) + 100000;

  console.log('estimatedGasLimitWithBufferAsNumber.toString()');
  console.log(estimatedGasLimitWithBufferAsNumber.toString());

  const gasPrice = await provider.getGasPrice();
  console.log(chalk.greenBright.bold(`Sending ...`));

  const tx = await sendPopulatedTx(
    chainId,
    ozRelayer,
    wallet,
    populatedTx,
    estimatedGasLimitWithBufferAsNumber,
    gasPrice,
    config.useFlashbots,
    txParams,
  );

  console.log(chalk.greenBright.bold('Transaction sent! ✔'));
  console.log(chalk.blueBright.bold('Transaction hash:', tx.hash));
  printSpacer();
  printNote();
};

/**
 * Runs the gas cost vs. rewards profit estimation for the DrawManager#finishDraw() function.
 *
 * @param {DrawAuctionConfig} config, draw auction config
 * @param {DrawAuctionContext} context, current state of the draw auction contracts
 * @param {DrawAuctionContracts} drawAuctionContracts, ethers.js Contract instances of all rng auction contracts
 *
 * @returns {undefined} void function
 */
const checkFinishDraw = async (
  config: DrawAuctionConfig,
  context: DrawAuctionContext,
  drawAuctionContracts: DrawAuctionContracts,
) => {
  const contract = drawAuctionContracts.drawManagerContract;

  const txParams = buildFinishDrawTxParams(config);

  const gasCostUsd = await getFinishDrawGasCostUsd(txParams, contract, config, context);
  if (gasCostUsd === 0) {
    printAsterisks();
    console.log(chalk.red('Gas cost is $0. Unable to determine profitability. Exiting ...'));
    return;
  }

  const { netProfitUsd, profitable } = await calculateFinishDrawProfit(
    config,
    context.finishDrawRewardUsd,
    gasCostUsd,
  );

  if (profitable) {
    await sendPopulatedFinishDrawTransaction(config, txParams, contract);
  } else {
    console.log(
      chalk.yellow(`Completing current auction currently not profitable. Try again soon ...`),
    );
  }
};

/**
 * Figures out how much gas is required to run the RngWitnet#startDraw() payable function
 *
 * @returns {Promise<BigNumber>} Promise object of the gas limit in wei as a BigNumber
 */
const getRngWitnetStartDrawEstimatedGasLimit = async (
  contract: Contract,
  rngWitnetStartDrawTxParams: RngWitnetStartDrawTxParams,
): Promise<BigNumber> => {
  let estimatedGasLimit;
  try {
    const { value, transformedTxParams }: StartDrawTransformedTxParams =
      transformRngWitnetStartDrawTxParams(rngWitnetStartDrawTxParams);

    estimatedGasLimit = await contract.estimateGas.startDraw(
      ...Object.values(transformedTxParams),
      {
        value,
      },
    );
  } catch (e) {
    console.log(chalk.red(e));
  }

  return estimatedGasLimit;
};

/**
 * Figures out how much gas is required to run the DrawManager#startDraw() payable function
 *
 * @returns {Promise<BigNumber>} Promise object of the gas limit in wei as a BigNumber
 */
const getRngBlockhashStartDrawEstimatedGasLimit = async (
  contract: Contract,
  rngBlockhashStartDrawTxParams: RngBlockhashStartDrawTxParams,
): Promise<BigNumber> => {
  let estimatedGasLimit;
  try {
    estimatedGasLimit = await contract.estimateGas.startDraw(
      ...Object.values(rngBlockhashStartDrawTxParams),
    );
  } catch (e) {
    console.log(chalk.red(e));
  }

  return estimatedGasLimit;
};

/**
 * Figures out how much gas is required to run the RngWitnet#finishDraw() function
 *
 * @returns {Promise<BigNumber>} Promise object of the gas limit in wei as a BigNumber
 */
const getFinishDrawEstimatedGasLimit = async (
  contract: Contract,
  finishDrawTxParams: FinishDrawTxParams,
): Promise<BigNumber> => {
  let estimatedGasLimit;
  try {
    estimatedGasLimit = await contract.estimateGas.startDraw(...Object.values(finishDrawTxParams));
  } catch (e) {
    console.log(chalk.red(e));
  }

  return estimatedGasLimit;
};

/**
 * Determines if the RngWitnet#startDraw() transaction will be profitable.
 *
 * Takes into account the cost of gas, the cost of the RNG fee to Witnet,
 * and the rewards we will earn.
 *
 * @param {DrawAuctionConfig} config, draw auction config
 * @param {DrawAuctionContext} context, current state of the draw auction contracts
 * @param {number} gasCostUsd USD Value of how much gas it will cost to run startDraw()
 *
 * @returns {Promise<boolean>} Promise object with boolean of profitable or not
 */
const calculateStartDrawProfit = async (
  config: DrawAuctionConfig,
  context: DrawAuctionContext,
  gasCostUsd: number,
): Promise<boolean> => {
  printAsterisks();
  printSpacer();
  printSpacer();
  console.log(chalk.blue(`Calculating profit ...`));
  console.log(chalk.magenta('Profit/Loss (USD):'));
  printSpacer();

  const grossProfitUsd = context.startDrawRewardUsd;
  console.log(chalk.magenta('Gross Profit = Reward'));

  const netProfitUsd = grossProfitUsd - gasCostUsd - context.rngFeeEstimateUsd;
  console.log(chalk.magenta('Net profit = (Gross Profit - Gas Fees [Max] - RNG Fee)'));
  console.log(
    chalk.greenBright(
      `$${roundTwoDecimalPlaces(netProfitUsd)} = ($${roundTwoDecimalPlaces(
        grossProfitUsd,
      )} - $${roundTwoDecimalPlaces(gasCostUsd)} - $${roundTwoDecimalPlaces(
        context.rngFeeEstimateUsd,
      )})`,
    ),
    chalk.dim(
      `$${netProfitUsd} = ($${grossProfitUsd} - $${gasCostUsd} - $${context.rngFeeEstimateUsd})`,
    ),
  );
  printSpacer();

  const profitable = netProfitUsd > config.minProfitThresholdUsd;
  logTable({
    MIN_PROFIT_THRESHOLD_USD: `$${config.minProfitThresholdUsd}`,
    'Net Profit (USD)': `$${roundTwoDecimalPlaces(netProfitUsd)}`,
    'Profitable?': checkOrX(profitable),
  });
  printSpacer();

  return profitable;
};

/**
 * Determines if the DrawManager#finishDraw() transaction will be profitable.
 *
 * Takes into account the cost of gas for the DrawManager#finishDraw(),
 * and the rewards earned.
 *
 * @param {DrawAuctionConfig} config, draw auction config
 * @param {DrawAuctionContext} context, current state of the draw auction contracts
 * @param {number} gasCostUsd USD Value of how much gas it will cost to run finishDraw()
 *
 * @returns {Promise} Promise of a boolean for profitability
 */
const calculateFinishDrawProfit = async (
  config: DrawAuctionConfig,
  rewardUsd: number,
  gasCostUsd: number,
): Promise<{ netProfitUsd: number; profitable: boolean }> => {
  printSpacer();
  printSpacer();
  console.log(chalk.blue(`Calculating profit ...`));

  printSpacer();
  console.log(chalk.magenta('Profit/Loss (USD):'));
  printSpacer();

  const grossProfitUsd = rewardUsd;
  console.log(chalk.magenta('Gross Profit = Reward'));

  const netProfitUsd = grossProfitUsd - gasCostUsd;
  console.log(chalk.magenta('Net profit = (Gross Profit - Gas Fees [Max])'));
  console.log(
    chalk.greenBright(
      `$${roundTwoDecimalPlaces(netProfitUsd)} = ($${roundTwoDecimalPlaces(
        rewardUsd,
      )} - $${roundTwoDecimalPlaces(gasCostUsd)})`,
    ),
    chalk.dim(`$${netProfitUsd} = ($${rewardUsd} - $${gasCostUsd})`),
  );

  printSpacer();

  const profitable = netProfitUsd > config.minProfitThresholdUsd;
  logTable({
    MIN_PROFIT_THRESHOLD_USD: `$${config.minProfitThresholdUsd}`,
    'Net Profit (USD)': `$${roundTwoDecimalPlaces(netProfitUsd)}`,
    'Profitable?': checkOrX(profitable),
  });
  printSpacer();

  return { netProfitUsd, profitable };
};

/**
 * Logs the context (state of the contracts) to the console.
 *
 * @param {number} chainId, the chain ID we're operating on
 * @param {DrawAuctionContext} context, current state of the draw auction contracts
 *
 * @returns {undefined} void function
 */
const printContext = (chainId: number, context: DrawAuctionContext) => {
  printAsterisks();
  printSpacer();
  console.log(chalk.blue.bold(`Tokens:`));

  printSpacer();
  logStringValue(
    `1a. Chain Native/Gas Token ${NETWORK_NATIVE_TOKEN_INFO[chainId].symbol} Market Rate (USD):`,
    `$${context.nativeTokenMarketRateUsd}`,
  );
  logStringValue(
    `1b. Reward Token '${context.rewardToken.symbol}' Market Rate (USD):`,
    `$${context.rewardToken.assetRateUsd}`,
  );

  printSpacer();
  printSpacer();
  console.log(chalk.blue.bold(`Rng Auction State:`));

  printSpacer();
  logStringValue(`2a. Can Start Draw? `, `${checkOrX(context.canStartDraw)}`);

  logStringValue(
    `2b. Start Draw Expected Reward:`,
    `${ethers.utils.formatUnits(context.startDrawReward, context.rewardToken.decimals)} ${
      context.rewardToken.symbol
    }`,
  );
  console.log(
    chalk.grey(`2c. Start Draw Expected Reward (USD):`),
    chalk.yellow(`$${roundTwoDecimalPlaces(context.startDrawRewardUsd)}`),
    chalk.dim(`$${context.startDrawRewardUsd}`),
  );
  logStringValue(
    `2d. PrizePool (${chainName(chainId)}) can start draw in:`,
    `${(context.prizePoolDrawClosesAt - Math.ceil(Date.now() / 1000)) / 60} minutes`,
  );

  printSpacer();
  printSpacer();
  console.log(chalk.blue.bold(`Finish Draw Auction State:`));
  printSpacer();
  logStringValue(`3a. Can Finish Draw? `, `${checkOrX(context.canFinishDraw)}`);

  logStringValue(
    `3b. Finish Draw Expected Reward:`,
    `${ethers.utils.formatUnits(context.finishDrawReward, context.rewardToken.decimals)} ${
      context.rewardToken.symbol
    }`,
  );
  console.log(
    chalk.grey(`3c. Finish Draw Expected Reward (USD):`),
    chalk.yellow(`$${roundTwoDecimalPlaces(context.finishDrawRewardUsd)}`),
    chalk.dim(`$${context.finishDrawRewardUsd}`),
  );

  printSpacer();
};

/**
 * Finds how much the gas will cost (in $ USD) for the RngWitnet#startDraw transaction
 *
 * @param {RngWitnetStartDrawTxParams} txParams, the startDraw() transaction parameters object
 * @param {Contract} contract, ethers.js Contract instance of the RngWitnet contract
 * @param {DrawAuctionConfig} config, draw auction config
 * @param {DrawAuctionContext} context, current state of the draw auction contracts
 *
 * @returns {number} Gas cost (in $ USD) for the startDraw function
 */
const getStartDrawGasCostUsd = async (
  config: DrawAuctionConfig,
  context: DrawAuctionContext,
  drawAuctionContracts: DrawAuctionContracts,
): Promise<number> => {
  const { nativeTokenMarketRateUsd } = context;

  console.log(chalk.blue(`Estimating RngWitnet#startDraw() gas costs ...`));
  printSpacer();

  let txParams;
  let estimatedGasLimit: BigNumber = BigNumber.from(0);
  let populatedTx: PopulatedTransaction;
  if (drawAuctionContracts.rngWitnetContract) {
    txParams = buildRngWitnetStartDrawTxParams(config, context, drawAuctionContracts);

    estimatedGasLimit = await getStartDrawEstimatedGasLimit(
      drawAuctionContracts.rngWitnetContract,
      txParams,
    );

    const { value, transformedTxParams }: StartDrawTransformedTxParams =
      transformRngWitnetStartDrawTxParams(txParams);

    populatedTx = await drawAuctionContracts.rngWitnetContract.populateTransaction.startDraw(
      ...Object.values(transformedTxParams),
      { value },
    );
  } else {
    txParams = buildRngBlockhashStartDrawTxParams(config, drawAuctionContracts);

    estimatedGasLimit = await getStartDrawEstimatedGasLimit(
      drawAuctionContracts.rngBlockhashContract,
      txParams,
    );

    populatedTx = await drawAuctionContracts.rngBlockhashContract.populateTransaction.startDraw(
      ...Object.values(txParams),
    );
  }

  // Add extra buffer space on the estimate because estimates are typically too low and cause tx's to fail
  const estimatedGasLimitWithBuffer: BigNumber = estimatedGasLimit.add(DRAW_GAS_LIMIT_BUFFER);

  const gasCostUsd = await getGasCostUsd(
    config,
    estimatedGasLimitWithBuffer,
    nativeTokenMarketRateUsd,
    populatedTx,
  );

  return gasCostUsd;
};

/**
 * Creates an object with all the transaction parameters for the RngBlockhash#startDraw() transaction.
 *
 * @param {DrawAuctionConfig} config, draw auction config
 * @param {DrawAuctionContracts} drawAuctionContracts, ethers.js Contract instances of all rng auction contracts
 *
 * @returns {RngBlockhashStartDrawTxParams} The startDraw() tx parameters object
 */
const buildRngBlockhashStartDrawTxParams = (
  config: DrawAuctionConfig,
  drawAuctionContracts: DrawAuctionContracts,
): RngBlockhashStartDrawTxParams => {
  return {
    drawManagerAddress: drawAuctionContracts.drawManagerContract.address,
    rewardRecipient: config.rewardRecipient,
  };
};

/**
 * Creates an object with all the transaction parameters for the RngWitnet#startDraw() transaction.
 *
 * @param {DrawAuctionConfig} config, draw auction config
 * @param {DrawAuctionContext} context, current state of the draw auction contracts
 * @param {DrawAuctionContracts} drawAuctionContracts, ethers.js Contract instances of all rng auction contracts
 *
 * @returns {RngWitnetStartDrawTxParams} The startDraw() tx parameters object
 */
const buildRngWitnetStartDrawTxParams = (
  config: DrawAuctionConfig,
  context: DrawAuctionContext,
  drawAuctionContracts: DrawAuctionContracts,
): RngWitnetStartDrawTxParams => {
  return {
    rngPaymentAmount: context.rngFeeEstimate,
    drawManagerAddress: drawAuctionContracts.drawManagerContract.address,
    rewardRecipient: config.rewardRecipient,
    value: context.rngFeeEstimate,
  };
};

/**
 * Creates an object with all the transaction parameters for the DrawManager#finishDraw() transaction.
 *
 * @param {DrawAuctionConfig} config, draw auction config
 *
 * @returns {FinishDrawTxParams} The finishDraw() tx parameters object
 */
const buildFinishDrawTxParams = (config: DrawAuctionConfig): FinishDrawTxParams => {
  return {
    rewardRecipient: config.rewardRecipient,
  };
};

/**
 * Finds how much the gas will cost (in $ USD) for the DrawManager#finishDraw transaction
 *
 * @param {FinishDrawTxParams} txParams, the finishDraw() transaction parameters object
 * @param {Contract} contract, ethers.js Contract instance of the DrawManager contract
 * @param {DrawAuctionConfig} config, draw auction config
 * @param {DrawAuctionContext} context, current state of the draw auction contracts
 *
 * @returns {FinishDrawTxParams} The finishDraw() tx parameters object
 */
const getFinishDrawGasCostUsd = async (
  txParams: FinishDrawTxParams,
  contract: Contract,
  config: DrawAuctionConfig,
  context: DrawAuctionContext,
): Promise<number> => {
  console.log(chalk.blue(`Estimating DrawManager#finishDraw() gas costs ...`));
  printSpacer();

  const { nativeTokenMarketRateUsd } = context;

  const estimatedGasLimit: BigNumber = await getFinishDrawEstimatedGasLimit(contract, txParams);

  const populatedTx: PopulatedTransaction = await contract.populateTransaction.finishDraw(
    ...Object.values(txParams),
  );

  // Add extra buffer space on the estimate because estimates are typically too low and cause tx's to fail
  const estimatedGasLimitWithBuffer: BigNumber = estimatedGasLimit.add(DRAW_GAS_LIMIT_BUFFER);

  const gasCostUsd = await getGasCostUsd(
    config,
    estimatedGasLimitWithBuffer,
    nativeTokenMarketRateUsd,
    populatedTx,
  );

  return gasCostUsd;
};

/**
 * Finds how much a transaction will cost (gas costs in $ USD) for the a generic contract tx function
 *
 * @param {DrawAuctionConfig} config, draw auction config
 * @param {BigNumber} estimatedGasLimit, BigNumber of a gas limit provided by ether.js estimateGas functions
 * @param {number} context, the current price (in $ USD) of the native (gas) token for this network
 * @param {populatedTx} PopulatedTransaction, the already-built object with transaction data, from, to, etc
 *
 * @returns {number} Amount gas will cost (in $ USD)
 */
const getGasCostUsd = async (
  config: DrawAuctionConfig,
  estimatedGasLimit: BigNumber,
  nativeTokenMarketRateUsd: number,
  populatedTx: PopulatedTransaction,
): Promise<number> => {
  const { chainId, provider } = config;

  if (!estimatedGasLimit || estimatedGasLimit.eq(0)) {
    console.error(chalk.yellow('Estimated gas limit is 0 ...'));
    return 0;
  } else {
    logBigNumber(
      'Estimated gas limit (wei):',
      estimatedGasLimit,
      NETWORK_NATIVE_TOKEN_INFO[chainId].decimals,
      NETWORK_NATIVE_TOKEN_INFO[chainId].symbol,
    );
  }

  const gasPrice = await provider.getGasPrice();
  logBigNumber(
    'Recent Gas Price (wei):',
    gasPrice,
    NETWORK_NATIVE_TOKEN_INFO[chainId].decimals,
    NETWORK_NATIVE_TOKEN_INFO[chainId].symbol,
  );
  logStringValue('Recent Gas Price (gwei):', `${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);

  printSpacer();
  const { avgFeeUsd } = await getFeesUsd(
    chainId,
    estimatedGasLimit,
    nativeTokenMarketRateUsd,
    provider,
    populatedTx.data,
  );
  console.log(
    chalk.grey(`Gas Cost (USD):`),
    chalk.yellow(`$${roundTwoDecimalPlaces(avgFeeUsd)}`),
    chalk.dim(`$${avgFeeUsd}`),
  );

  return avgFeeUsd;
};

/**
 * Fires off the DrawManager#finishDraw() transaction.
 *
 * @param {DrawAuctionConfig} config, draw auction config
 * @param {FinishDrawTxParams} txParams, transaction parameters
 * @param {Contract} contract, ethers.js Contract instance of the DrawManager contract
 */
const sendPopulatedFinishDrawTransaction = async (
  config: DrawAuctionConfig,
  txParams: FinishDrawTxParams,
  contract: Contract,
) => {
  const { chainId, wallet, ozRelayer, provider } = config;
  const gasPrice = await provider.getGasPrice();

  const estimatedGasLimit: BigNumber = await getFinishDrawEstimatedGasLimit(contract, txParams);
  console.log('estimatedGasLimit');
  console.log(estimatedGasLimit);
  console.log('estimatedGasLimit.toString()');
  console.log(estimatedGasLimit.toString());
  const estimatedGasLimitWithBufferAsNumber: number =
    Number(estimatedGasLimit) + DRAW_GAS_LIMIT_BUFFER;
  console.log('estimatedGasLimitWithBufferAsNumber.toString()');
  console.log(estimatedGasLimitWithBufferAsNumber.toString());

  console.log(chalk.green(`Execute DrawManager#finishDraw`));
  console.log(chalk.greenBright.bold(`Sending ...`));
  printSpacer();

  const populatedTx = await contract.populateTransaction.finishDraw(...Object.values(txParams));

  const tx = await sendPopulatedTx(
    chainId,
    ozRelayer,
    wallet,
    populatedTx,
    estimatedGasLimitWithBufferAsNumber,
    gasPrice,
    false,
    txParams,
  );

  console.log(chalk.greenBright.bold('Transaction sent! ✔'));
  console.log(chalk.blueBright.bold('Transaction hash:', tx.hash));
  printSpacer();
  printNote();
};

/**
 * Returns emojis (for pretty console logging).
 *
 * @param {boolean} bool
 *
 * @returns {string}
 */
const checkOrX = (bool: boolean): string => {
  return bool ? '✔' : '✗';
};

/**
 * Takes the current RngWitnetStartDrawTxParams transaction params and breaks off the 'value' param into it's own variable,
 * then returns a modified version of the original transaction params without the 'value' param.
 *
 * @param {RngWitnetStartDrawTxParams} txParams
 *
 * @returns {StartDrawTransformedTxParams}
 */
const transformRngWitnetStartDrawTxParams = (
  txParams: RngWitnetStartDrawTxParams,
): StartDrawTransformedTxParams => {
  const transformedTxParams = { ...txParams };

  const value = transformedTxParams.value;
  delete transformedTxParams.value;

  return { value, transformedTxParams };
};

/**
 * A note telling the bot maintainer where they can claim the rewards they earn.
 */
const printNote = () => {
  console.log(chalk.yellow('|*******************************************************|'));
  console.log(chalk.yellow('|                                                       |'));
  console.log(chalk.yellow('|    Rewards accumulate post-draw on the PrizePool!     |'));
  console.log(chalk.yellow('|  Withdraw your rewards manually from that contract.   |'));
  console.log(chalk.yellow('|                                                       |'));
  console.log(chalk.yellow('|*******************************************************|'));
};
