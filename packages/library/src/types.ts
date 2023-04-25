import { BigNumber } from "@ethersproject/bignumber";
import { Provider } from "@ethersproject/providers";

// Config types
export interface TokenData {
  chainId: number;
  address: string;
  name: string;
  decimals: number;
  symbol: string;
  extensions: {
    underlyingAsset: {
      address: string;
      symbol: string;
      name: string;
    };
  };
}

export interface ContractData {
  address: string;
  chainId: number;
  type: string;
  abi: any;
  version: {
    major: number;
    minor: number;
    patch: number;
  };
  tokens?: TokenData[];
}

export interface ContractsBlob {
  name: string;
  version: {
    major: number;
    minor: number;
    patch: number;
  };
  timestamp: string;
  contracts: ContractData[];
}

export interface Config {
  chainId: number;
  network: string;
  apiKey: string | undefined;
  speed?: "slow" | "normal" | "fast";
  gasLimit?: number | string;
  execute?: Boolean;
}

export interface ProviderOptions {
  chainId: number;
  provider: Provider;
}

export interface ProviderUrlOptions {
  chainId: number;
  providerUrl: string;
}

// OpenZeppelin Defender types
export type Secrets = {
  infuraApiKey?: string;

  // Mainnet
  ethereumMainnetProviderURL?: string;

  // Testnet
  ethereumSepoliaProviderURL?: string;
};

// Contracts types
export interface Draw {
  drawId: number;
  beaconPeriodSeconds: number;
  timestamp: number;
  getBeaconPeriodSeconds: Function;
}

export interface ContractPrizeTierHistory {
  getPrizeTier: Function;
}
export interface ReserverContract {
  getReserveAccumulatedBetween: Function;
}

export interface Draw {
  drawId: number;
  winningRandomNumber: BigNumber;
  timestamp: number;
  beaconPeriodStartedAt: number;
  beaconPeriodSeconds: number;
}

export interface PrizeDistribution {
  bitRangeSize: number;
  matchCardinality: number;
  startTimestampOffset?: number;
  endTimestampOffset?: number;
  maxPicksPerUser: number;
  expiryDuration: number;
  numberOfPicks: BigNumber;
  tiers: Array<BigNumber | number>;
  prize: BigNumber;
}

export interface PrizeTier {
  bitRangeSize: number;
  drawId: number;
  maxPicksPerUser: number;
  expiryDuration: number;
  endTimestampOffset: number;
  prize: BigNumber;
  tiers: Array<number>;
}

export interface Vault {
  id: string;
  accounts: VaultAccount[];
}

export interface VaultAccount {
  id: string;
}

export interface VaultWinners {
  [vault: string]: {
    tiers: number[];
    winners: string[];
  };
}

type Token = {
  name: string;
  decimals: string;
  address: string;
  symbol: string;
};

export type ClaimPrizeContext = {
  feeToken: Token;
};

export type GetClaimerProfitablePrizeTxsParams = {
  chainId: number;
  feeRecipient: string;
};
