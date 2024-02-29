import { ethers, BigNumber, Contract, PopulatedTransaction } from 'ethers';
import { ContractsBlob, getContract } from '@generationsoftware/pt-v5-utils-js';
import chalk from 'chalk';

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

type StartDrawTxParams = {
  drawManagerAddress: string;
  rewardRecipient: string;
  value: BigNumber;
};

type AwardDrawTxParams = {
  rewardRecipient: string;
};

type StartDrawTransformedTxParams = {
  transformedTxParams: object;
  value: BigNumber;
};

const MAX_FORCE_RELAY_LOSS_THRESHOLD_USD = -5; // -$5 USD

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

  if (!context.drawAuctionState) {
    printAsterisks();
    console.log(chalk.yellow(`Currently no Rng or RngRelay auctions to complete. Exiting ...`));
    printSpacer();
    return;
  }

  if (context.drawAuctionState === DrawAuctionState.Start) {
    console.log(chalk.yellow(`Processing 'start draw' for ${chainName(chainId)}:`));
    await checkStartDraw(config, context, drawAuctionContracts);
  } else if (context.drawAuctionState === DrawAuctionState.Award) {
    console.log(chalk.yellow(`Processing 'award draw' for ${chainName(chainId)}:`));
    await checkAwardDraw(config, context, drawAuctionContracts);
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
  const rngWitnetContract = getContract('RngWitnet', chainId, provider, contracts, version);

  logTable({
    prizePoolContract: prizePoolContract.address,
    drawManagerContract: drawManagerContract.address,
    rngWitnetContract: rngWitnetContract.address,
  });

  return {
    prizePoolContract,
    drawManagerContract,
    rngWitnetContract,
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

  const contract: Contract = drawAuctionContracts.rngWitnetContract;
  const txParams: StartDrawTxParams = buildStartDrawTxParams(config, context, drawAuctionContracts);
  console.log('txParams');
  console.log(txParams);

  const { value, transformedTxParams }: StartDrawTransformedTxParams =
    transformStartDrawTxParams(txParams);

  const populatedTx: PopulatedTransaction = await contract.populateTransaction.startDraw(
    ...Object.values(transformedTxParams),
    { value },
  );
  console.log('populatedTx');
  console.log(populatedTx);

  const gasPrice = await provider.getGasPrice();
  console.log(chalk.greenBright.bold(`Sending ...`));
  console.log('gasPrice');
  console.log(gasPrice);
  // const gasPrice = BigNumber.from(100000000);

  const gasLimit = 850000;
  const tx = await sendPopulatedTx(
    chainId,
    ozRelayer,
    wallet,
    populatedTx,
    gasLimit,
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
 * Runs the gas cost vs. rewards profit estimation for the DrawManager#awardDraw() function.
 *
 * @param {DrawAuctionConfig} config, draw auction config
 * @param {DrawAuctionContext} context, current state of the draw auction contracts
 * @param {DrawAuctionContracts} drawAuctionContracts, ethers.js Contract instances of all rng auction contracts
 *
 * @returns {undefined} void function
 */
const checkAwardDraw = async (
  config: DrawAuctionConfig,
  context: DrawAuctionContext,
  drawAuctionContracts: DrawAuctionContracts,
) => {
  const contract = drawAuctionContracts.drawManagerContract;

  const txParams = buildAwardDrawTxParams(config);

  const gasCostUsd = await getAwardDrawGasCostUsd(txParams, contract, config, context);
  if (gasCostUsd === 0) {
    printAsterisks();
    console.log(chalk.red('Gas cost is $0. Unable to determine profitability. Exiting ...'));
    return;
  }

  const { netProfitUsd, profitable } = await calculateAwardDrawProfit(
    config,
    context.awardDrawFeeUsd,
    gasCostUsd,
  );
  console.log('profitable');
  console.log(profitable);

  const forceAwardDraw = checkForceAwardDraw(config, context, netProfitUsd);
  console.log('forceAwardDraw');
  console.log(forceAwardDraw);

  if (profitable || forceAwardDraw) {
    await sendPopulatedAwardDrawTransaction(config, txParams, contract);
  } else {
    console.log(
      chalk.yellow(`Completing current auction currently not profitable. Try again soon ...`),
    );
  }
};

/**
 * If we already submitted the startAward request - and therefore paid the fees for the random number
 * and gas fee for it - we should make sure the relay goes through - making sure that it was us who won the
 * initial startAward auction, and that the amount of loss we'll take is within acceptable range
 *
 * @param {DrawAuctionConfig} config, draw auction config
 * @param {DrawAuctionContext} context, current state of the draw auction contracts
 * @param {DrawAuctionContracts} drawAuctionContracts, ethers.js Contract instances of all rng auction contracts
 *
 * @returns {boolean} if we should attempt to force the awardDraw() transaction or not
 */
const checkForceAwardDraw = (
  config: DrawAuctionConfig,
  context: DrawAuctionContext,
  netProfitUsd: number,
) => {
  // Is recipient for the StartRNG auction same as the upcoming Relay?
  // (this is a bit naïve as the RNG reward recipient could differ from the relay reward recipient,
  //   but it's likely this will be the same address)
  // const sameRecipient = relay.context.rngLastAuctionResult.recipient === config.rewardRecipient;
  // console.log('sameRecipient');
  // console.log(sameRecipient);

  console.log('netProfitUsd');
  console.log(netProfitUsd);

  console.log('MAX_FORCE_RELAY_LOSS_THRESHOLD_USD');
  console.log(MAX_FORCE_RELAY_LOSS_THRESHOLD_USD);

  const lossOkay = netProfitUsd > MAX_FORCE_RELAY_LOSS_THRESHOLD_USD;
  console.log('lossOkay');
  console.log(lossOkay);

  // return context.auctionClosesSoon && sameRecipient && lossOkay;
  return context.auctionClosesSoon && lossOkay;
};

/**
 * Figures out how much gas is required to run the RngWitnet#startDraw() payable function
 *
 * @returns {Promise<BigNumber>} Promise object of the gas limit in wei as a BigNumber
 */
const getStartDrawEstimatedGasLimit = async (
  contract: Contract,
  startDrawTxParams: StartDrawTxParams,
): Promise<BigNumber> => {
  let estimatedGasLimit;
  try {
    const { value, transformedTxParams }: StartDrawTransformedTxParams =
      transformStartDrawTxParams(startDrawTxParams);

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

  const grossProfitUsd = context.startDrawFeeUsd;
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
 * Determines if the DrawManager#awardDraw() transaction will be profitable.
 *
 * Takes into account the cost of gas for the DrawManager#awardDraw(),
 * and the rewards earned.
 *
 * @param {DrawAuctionConfig} config, draw auction config
 * @param {DrawAuctionContext} context, current state of the draw auction contracts
 * @param {number} gasCostUsd USD Value of how much gas it will cost to run awardDraw()
 *
 * @returns {Promise} Promise of a boolean for profitability
 */
const calculateAwardDrawProfit = async (
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

  printSpacer();
  logStringValue(
    `1b. Reward Token '${context.rewardToken.symbol}' Market Rate (USD):`,
    `$${context.rewardToken.assetRateUsd}`,
  );

  printSpacer();
  printSpacer();
  console.log(chalk.blue.bold(`Rng Auction State:`));

  printSpacer();
  logStringValue(`2a. Can Start Draw? `, `${checkOrX(context.canStartDraw)}`);

  if (context.canStartDraw) {
    printSpacer();
    logStringValue(
      `2b. Start Draw ${chainName(chainId)} Expected Reward:`,
      `${context.startDrawFee.toString()} ${context.rewardToken.symbol}`,
    );
    console.log(
      chalk.grey(`2c. Start Draw ${chainName(chainId)} Expected Reward (USD):`),
      chalk.yellow(`$${roundTwoDecimalPlaces(context.startDrawFeeUsd)}`),
      chalk.dim(`$${context.startDrawFeeUsd}`),
    );
  } else {
    printSpacer();

    logStringValue(
      `${chainName(chainId)} PrizePool can start draw in:`,
      `${(context.prizePoolDrawClosesAt - Math.ceil(Date.now() / 1000)) / 60} minutes`,
    );
    printSpacer();
  }

  printSpacer();
  printSpacer();
  console.log(chalk.blue.bold(`Award Draw Auction State:`));

  logStringValue(`3a. Can Award Draw? `, `${checkOrX(context.canAwardDraw)}`);
  if (context.canAwardDraw) {
    logBigNumber(
      `3b. Award Draw Expected Reward:`,
      context.awardDrawFee.toString(),
      context.rewardToken.decimals,
      context.rewardToken.symbol,
    );
    console.log(
      chalk.grey(`3c. Award Draw Expected Reward (USD):`),
      chalk.yellow(`$${roundTwoDecimalPlaces(context.awardDrawFeeUsd)}`),
      chalk.dim(`$${context.awardDrawFeeUsd}`),
    );
  }

  printSpacer();
};

/**
 * Finds how much the gas will cost (in $ USD) for the RngWitnet#startDraw transaction
 *
 * @param {StartDrawTxParams} txParams, the startDraw() transaction parameters object
 * @param {Contract} contract, ethers.js Contract instance of the RngWitnet contract
 * @param {DrawAuctionConfig} config, draw auction config
 * @param {DrawAuctionContext} context, current state of the draw auction contracts
 *
 * @returns {StartDrawTxParams} The startDraw() tx parameters object
 */
const getStartDrawGasCostUsd = async (
  config: DrawAuctionConfig,
  context: DrawAuctionContext,
  drawAuctionContracts: DrawAuctionContracts,
): Promise<number> => {
  const { nativeTokenMarketRateUsd } = context;

  console.log(chalk.blue(`Estimating RngWitnet#startDraw() gas costs ...`));
  printSpacer();

  const startDrawTxParams = buildStartDrawTxParams(config, context, drawAuctionContracts);

  const estimatedGasLimit: BigNumber = await getStartDrawEstimatedGasLimit(
    drawAuctionContracts.rngWitnetContract,
    startDrawTxParams,
  );

  const { value, transformedTxParams }: StartDrawTransformedTxParams =
    transformStartDrawTxParams(startDrawTxParams);
  const populatedTx: PopulatedTransaction =
    await drawAuctionContracts.rngWitnetContract.populateTransaction.startDraw(
      ...Object.values(transformedTxParams),
      { value },
    );

  // hard-coded gas limit:
  // estimatedGasLimit = BigNumber.from(630000);
  const gasCostUsd = await getGasCostUsd(
    config,
    estimatedGasLimit,
    nativeTokenMarketRateUsd,
    populatedTx,
  );

  return gasCostUsd;
};

/**
 * Creates an object with all the transaction parameters for the RngWitnet#startDraw() transaction.
 *
 * @param {DrawAuctionConfig} config, draw auction config
 * @param {DrawAuctionContext} context, current state of the draw auction contracts
 * @param {DrawAuctionContracts} drawAuctionContracts, ethers.js Contract instances of all rng auction contracts
 *
 * @returns {StartDrawTxParams} The startDraw() tx parameters object
 */
const buildStartDrawTxParams = (
  config: DrawAuctionConfig,
  context: DrawAuctionContext,
  drawAuctionContracts: DrawAuctionContracts,
): StartDrawTxParams => {
  return {
    drawManagerAddress: drawAuctionContracts.drawManagerContract.address,
    rewardRecipient: config.rewardRecipient,
    value: context.rngFeeEstimate.mul(2), //  double this since the estimate always comes back shy of enough
  };
};

/**
 * Creates an object with all the transaction parameters for the DrawManager#awardDraw() transaction.
 *
 * @param {DrawAuctionConfig} config, draw auction config
 *
 * @returns {AwardDrawTxParams} The awardDraw() tx parameters object
 */
const buildAwardDrawTxParams = (config: DrawAuctionConfig): AwardDrawTxParams => {
  return {
    rewardRecipient: config.rewardRecipient,
  };
};

/**
 * Finds how much the gas will cost (in $ USD) for the DrawManager#awardDraw transaction
 *
 * @param {AwardDrawTxParams} txParams, the awardDraw() transaction parameters object
 * @param {Contract} contract, ethers.js Contract instance of the DrawManager contract
 * @param {DrawAuctionConfig} config, draw auction config
 * @param {DrawAuctionContext} context, current state of the draw auction contracts
 *
 * @returns {AwardDrawTxParams} The awardDraw() tx parameters object
 */
const getAwardDrawGasCostUsd = async (
  txParams: AwardDrawTxParams,
  contract: Contract,
  config: DrawAuctionConfig,
  context: DrawAuctionContext,
): Promise<number> => {
  console.log(chalk.blue(`Estimating DrawManager#awardDraw() gas costs ...`));
  printSpacer();

  const { chainId, provider } = config;
  const { nativeTokenMarketRateUsd } = context;

  // The relay uses 156,000~ gas, set to 200k just in case
  const estimatedGasLimit: BigNumber = BigNumber.from(400000);
  const populatedTx: PopulatedTransaction = await contract.populateTransaction.awardDraw(
    ...Object.values(txParams),
  );

  const gasCostUsd = await getGasCostUsd(
    config,
    estimatedGasLimit,
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
 * Fires off the DrawManager#awardDraw() transaction.
 *
 * @param {DrawAuctionConfig} config, draw auction config
 * @param {AwardDrawTxParams} txParams, transaction parameters
 * @param {Contract} contract, ethers.js Contract instance of the DrawManager contract
 */
const sendPopulatedAwardDrawTransaction = async (
  config: DrawAuctionConfig,
  txParams: AwardDrawTxParams,
  contract: Contract,
) => {
  const { chainId, wallet, ozRelayer, provider } = config;
  const gasPrice = await provider.getGasPrice();

  console.log(chalk.green(`Execute DrawManager#awardDraw`));
  console.log(chalk.greenBright.bold(`Sending ...`));
  printSpacer();

  const populatedTx = await contract.populateTransaction.awardDraw(...Object.values(txParams));

  const gasLimit = 800000;
  const tx = await sendPopulatedTx(
    chainId,
    ozRelayer,
    wallet,
    populatedTx,
    gasLimit,
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
 * Takes the current StartDrawTxParams transaction params and breaks off the 'value' param into it's own variable,
 * then returns a modified version of the original transaction params without the 'value' param.
 *
 * @param {StartDrawTxParams} txParams
 *
 * @returns {StartDrawTransformedTxParams}
 */
const transformStartDrawTxParams = (txParams: StartDrawTxParams): StartDrawTransformedTxParams => {
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
  console.log(chalk.yellow('|  Rewards accumulate post-awarding on the PrizePool!   |'));
  console.log(chalk.yellow('|  Withdraw your rewards manually from that contract.   |'));
  console.log(chalk.yellow('|                                                       |'));
  console.log(chalk.yellow('|*******************************************************|'));
};
