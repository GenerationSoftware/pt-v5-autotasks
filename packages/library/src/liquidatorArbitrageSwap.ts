import { ethers, Contract, BigNumber } from "ethers";
import { Provider } from "@ethersproject/providers";
import { PopulatedTransaction } from "@ethersproject/contracts";
import { DefenderRelaySigner } from "defender-relay-client/lib/ethers";
import { Relayer } from "defender-relay-client";
import chalk from "chalk";

import { ContractsBlob, Token, ArbLiquidatorSwapParams, ArbLiquidatorContext } from "./types";
import {
  logTable,
  logStringValue,
  logBigNumber,
  printAsterisks,
  printSpacer,
  getContract,
  getContracts,
  getFeesUsd,
  getEthMarketRateUsd,
  roundTwoDecimalPlaces,
  arbLiquidatorMulticall
} from "./utils";
import { ERC20Abi } from "./abis/ERC20Abi";

const MIN_PROFIT_THRESHOLD_USD = 5; // Only swap if we're going to make at least $5.00

interface SwapExactAmountInParams {
  liquidationPairAddress: string;
  swapRecipient: string;
  exactAmountIn: BigNumber;
  amountOutMin: BigNumber;
}

// Curently this does not return PopulatedTransactions like the other bots as we want to send each swap transaction
// the instant we know if it is profitable or not as we iterate through all LiquidityPairs
//
export async function liquidatorArbitrageSwap(
  contracts: ContractsBlob,
  relayer: Relayer,
  params: ArbLiquidatorSwapParams
) {
  const { swapRecipient, relayerAddress, readProvider, writeProvider } = params;

  // #1. Get contracts
  //
  const { liquidationPairs, liquidationRouter, marketRate } = getLiquidationContracts(
    contracts,
    params
  );

  // Loop through all liquidation pairs
  printSpacer();
  console.log(chalk.white.bgBlack(` # of Liquidation Pairs: ${liquidationPairs.length} `));
  for (let i = 0; i < liquidationPairs.length; i++) {
    printAsterisks();
    const liquidationPair = liquidationPairs[i];
    console.log(`LiquidationPair #${i + 1}`);
    console.log(liquidationPair.address);
    printSpacer();

    const context: ArbLiquidatorContext = await getContext(
      marketRate,
      liquidationRouter,
      liquidationPair,
      contracts,
      readProvider,
      relayerAddress
    );

    printContext(context);
    printAsterisks();

    // #2. Calculate amounts
    //
    console.log(chalk.blue(`1. Amounts:`));

    const { exactAmountIn, amountOutMin } = await calculateAmounts(liquidationPair, context);

    // #3. Print balance of tokenIn for relayer
    //
    const { sufficientBalance } = await checkBalance(context, exactAmountIn);

    if (sufficientBalance) {
      console.log(chalk.green("Sufficient balance ✔"));
    } else {
      console.log(chalk.red("Insufficient balance ✔"));

      const diff = exactAmountIn.sub(context.relayer.tokenInBalance);
      console.log(chalk.grey(`Increase balance by: ${diff}`));

      // continue;
    }

    // #4. Get allowance approval (necessary before upcoming static call)
    //
    await approve(exactAmountIn, liquidationRouter, writeProvider, relayerAddress, context);

    // #5. Test tx to get estimated return of tokenOut
    //
    printAsterisks();
    console.log(chalk.blue.bold(`3. Getting amount to receive ...`));
    const swapExactAmountInParams: SwapExactAmountInParams = {
      liquidationPairAddress: liquidationPair.address,
      swapRecipient,
      exactAmountIn,
      amountOutMin
    };
    const amountOutEstimate = await liquidationRouter.callStatic.swapExactAmountIn(
      ...Object.values(swapExactAmountInParams)
    );
    logBigNumber(
      `Estimated amount of tokenOut to receive:`,
      amountOutEstimate,
      context.tokenOut.decimals,
      context.tokenOut.symbol
    );

    // #6. Decide if profitable or not
    //
    const profitable = await calculateProfit(
      contracts,
      marketRate,
      liquidationRouter,
      swapExactAmountInParams,
      readProvider,
      context
    );
    if (!profitable) {
      console.log(
        chalk.red(
          `Liquidation Pair ${context.tokenIn.symbol}/${context.tokenOut.symbol}: currently not a profitable trade.`
        )
      );
      // continue;
      throw new Error();
    }

    // #7. Finally, populate tx when profitable
    try {
      let transactionPopulated: PopulatedTransaction | undefined;
      console.log(chalk.blue("6. Populating swap transaction ..."));
      printSpacer();

      transactionPopulated = await liquidationRouter.populateTransaction.swapExactAmountIn(
        ...Object.values(swapExactAmountInParams)
      );

      let transactionSentToNetwork = await relayer.sendTransaction({
        data: transactionPopulated.data,
        to: transactionPopulated.to,
        gasLimit: 450000
      });
      console.log(chalk.greenBright.bold("Transaction sent! ✔"));
      console.log(chalk.green("Transaction hash:", transactionSentToNetwork.hash));
    } catch (error) {
      throw new Error(error);
    }
  }
}

// Allowance
//
// Give permission to the LiquidationRouter to spend our Relayer/SwapRecipient's `tokenIn` (likely POOL)
// We will set allowance to max as we trust the security of the LiquidationRouter contract
const approve = async (
  exactAmountIn: BigNumber,
  liquidationRouter: Contract,
  writeProvider: Provider | DefenderRelaySigner,
  relayerAddress: string,
  context: ArbLiquidatorContext
) => {
  try {
    printSpacer();
    console.log("Checking 'tokenIn' ERC20 allowance...");

    const tokenInAddress = context.tokenIn.address;
    const token = new ethers.Contract(tokenInAddress, ERC20Abi, writeProvider);

    const allowance = context.relayer.tokenInAllowance;

    if (allowance.lt(exactAmountIn)) {
      const tx = await token.approve(liquidationRouter.address, ethers.constants.MaxInt256);
      await tx.wait();

      const newAllowanceResult = await token.functions.allowance(
        relayerAddress,
        liquidationRouter.address
      );
      logStringValue("New allowance:", newAllowanceResult[0].toString());
    } else {
      console.log(chalk.green("Sufficient allowance ✔"));
    }
  } catch (error) {
    console.log(chalk.red("error: ", error));
  }
};

const getLiquidationContracts = (
  contracts: ContractsBlob,
  params: ArbLiquidatorSwapParams
): {
  liquidationPairs: Contract[];
  liquidationRouter: Contract;
  marketRate: Contract;
} => {
  const { chainId, readProvider, writeProvider } = params;

  const contractsVersion = {
    major: 1,
    minor: 0,
    patch: 0
  };

  const liquidationPairs = getContracts(
    "LiquidationPair",
    chainId,
    readProvider,
    contracts,
    contractsVersion
  );
  const liquidationRouter = getContract(
    "LiquidationRouter",
    chainId,
    writeProvider,
    contracts,
    contractsVersion
  );
  const marketRate = getContract("MarketRate", chainId, readProvider, contracts, contractsVersion);

  return { liquidationPairs, liquidationRouter, marketRate };
};

// Gather information about this specific liquidation pair
// `tokenIn` is the token to supply (likely the prize token, which is probably POOL),
// This gets complicated because `tokenOut` is the Vault/Yield token, not the underlying
// asset which is likely the desired token (ie. DAI, USDC) - the desired
// token is called `tokenOutUnderlyingAsset`
//
const getContext = async (
  marketRate: Contract,
  liquidationRouter: Contract,
  liquidationPair: Contract,
  contracts: ContractsBlob,
  readProvider: Provider,
  relayerAddress: string
): Promise<ArbLiquidatorContext> => {
  const context: ArbLiquidatorContext = await arbLiquidatorMulticall(
    marketRate,
    liquidationRouter,
    liquidationPair,
    contracts,
    readProvider,
    relayerAddress
  );

  return context;
};

const printContext = context => {
  printAsterisks();
  console.log(chalk.blue(`Liquidation Pair: ${context.tokenIn.symbol}/${context.tokenOut.symbol}`));
  printSpacer();

  logTable({
    tokenIn: context.tokenIn,
    tokenOut: context.tokenOut,
    tokenOutUnderlyingAsset: context.tokenOutUnderlyingAsset
  });
  logBigNumber(
    `Relayer ${context.tokenIn.symbol} balance:`,
    context.relayer.tokenInBalance,
    context.tokenIn.decimals,
    context.tokenIn.symbol
  );
  logBigNumber(
    `Relayer ${context.tokenIn.symbol} allowance:`,
    context.relayer.tokenInAllowance,
    context.tokenIn.decimals,
    context.tokenIn.symbol
  );
};

const checkBalance = async (
  context: ArbLiquidatorContext,
  exactAmountIn: BigNumber
): Promise<{ sufficientBalance: boolean }> => {
  printAsterisks();
  console.log(chalk.blue("2. Balance & Allowance"));
  console.log("Checking relayer 'tokenIn' balance ...");

  const tokenInBalance = context.relayer.tokenInBalance;
  const sufficientBalance = tokenInBalance.gt(exactAmountIn);

  return { sufficientBalance };
};

const calculateProfit = async (
  contracts: ContractsBlob,
  marketRate: Contract,
  liquidationRouter: Contract,
  swapExactAmountInParams: SwapExactAmountInParams,
  readProvider: Provider,
  context: ArbLiquidatorContext
): Promise<Boolean> => {
  const { amountOutMin, exactAmountIn } = swapExactAmountInParams;

  const ethMarketRateUsd = await getEthMarketRateUsd(contracts, marketRate);

  printAsterisks();
  console.log(chalk.blue("4. Current gas costs for transaction:"));
  const estimatedGasLimit = await liquidationRouter.estimateGas.swapExactAmountIn(
    ...Object.values(swapExactAmountInParams)
  );
  const { baseFeeUsd, maxFeeUsd, avgFeeUsd } = await getFeesUsd(
    estimatedGasLimit,
    ethMarketRateUsd,
    readProvider
  );
  printSpacer();
  logBigNumber("Estimated gas limit:", estimatedGasLimit, 18, "ETH");

  logTable({ baseFeeUsd, maxFeeUsd, avgFeeUsd });

  printAsterisks();
  console.log(chalk.blue("5. Profit/Loss (USD):"));
  printSpacer();

  const tokenOutUnderlyingAssetUsd =
    parseFloat(ethers.utils.formatUnits(amountOutMin, context.tokenOut.decimals)) *
    context.tokenOutUnderlyingAsset.assetRateUsd;
  const tokenInUsd =
    parseFloat(ethers.utils.formatUnits(exactAmountIn, context.tokenIn.decimals)) *
    context.tokenIn.assetRateUsd;

  const grossProfitUsd = tokenOutUnderlyingAssetUsd - tokenInUsd;
  const netProfitUsd = grossProfitUsd - maxFeeUsd;

  console.log(chalk.magenta("Gross profit = tokenOut - tokenIn"));
  console.log(
    chalk.greenBright(
      `$${roundTwoDecimalPlaces(grossProfitUsd)} = $${roundTwoDecimalPlaces(
        tokenOutUnderlyingAssetUsd
      )} - $${roundTwoDecimalPlaces(tokenInUsd)}`
    )
  );
  printSpacer();

  console.log(chalk.magenta("Net profit = Gross profit - Gas fee (Max)"));
  console.log(
    chalk.greenBright(
      `$${roundTwoDecimalPlaces(netProfitUsd)} = $${roundTwoDecimalPlaces(
        grossProfitUsd
      )} - $${roundTwoDecimalPlaces(maxFeeUsd)}`
    )
  );
  printSpacer();

  const profitable = netProfitUsd > MIN_PROFIT_THRESHOLD_USD;
  logTable({
    MIN_PROFIT_THRESHOLD_USD: `$${MIN_PROFIT_THRESHOLD_USD}`,
    "Net profit (USD)": `$${roundTwoDecimalPlaces(netProfitUsd)}`,
    "Profitable?": profitable ? "✔" : "✗"
  });
  printSpacer();

  return profitable;
};

const calculateAmounts = async (
  liquidationPair: Contract,
  context: ArbLiquidatorContext
): Promise<{
  exactAmountIn: BigNumber;
  amountOutMin: BigNumber;
}> => {
  const maxAmountOut = await liquidationPair.callStatic.maxAmountOut();
  logBigNumber(
    `Max amount out available:`,
    maxAmountOut,
    context.tokenOut.decimals,
    context.tokenOut.symbol
  );

  // Needs to be based on how much the bot owner has of tokenIn
  // as well as how big of a trade they're willing to do
  const divisor = 1;
  if (divisor !== 1) {
    logStringValue("Divide max amount out by:", Math.round(divisor));
  }
  const wantedAmountOut = maxAmountOut.div(divisor);
  logBigNumber(
    "Wanted amount out:",
    wantedAmountOut,
    context.tokenOut.decimals,
    context.tokenOut.symbol
  );
  printSpacer();

  const exactAmountIn = await liquidationPair.callStatic.computeExactAmountIn(wantedAmountOut);
  logBigNumber("Exact amount in:", exactAmountIn, context.tokenIn.decimals, context.tokenIn.symbol);

  const amountOutMin = await liquidationPair.callStatic.computeExactAmountOut(exactAmountIn);
  logBigNumber(
    "Amount out minimum:",
    amountOutMin,
    context.tokenOut.decimals,
    context.tokenOut.symbol
  );

  return {
    exactAmountIn,
    amountOutMin
  };
};