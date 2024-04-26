import { CHAIN_IDS } from './network.js';

export const KNOWN_TOKENS = {
  [CHAIN_IDS.mainnet]: {
    POOL: '0x0cec1a9154ff802e7934fc916ed7ca50bde6844e',
    WBTC: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    WETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    DAI: '0x6b175474e89094c44da98b954eedeac495271d0f',
    LUSD: '0x5f98805a4e8be255a32880fdec7f6728c6568ba0',
    GUSD: '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd',
    OP: '0x2eecb20df51dc76d05afcf1270c73a2ff1035388',
    LINK: '0x514910771af9ca656af840dff83e8264ecf986ca',
  },
  [CHAIN_IDS.optimism]: {
    POOL: '0x395ae52bb17aef68c2888d941736a71dc6d4e125',
    WETH: '0x4200000000000000000000000000000000000006',
    USDC: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
    USDCE: '0x7f5c764cbc14f9669b88837ca1490cca17c31607',
    DAI: '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1',
    LUSD: '0xc40f949f8a4e094d1b49a23ea9241d289b7b2819',
    OP: '0x4200000000000000000000000000000000000042',
    PRZUSDC: '0x03d3ce84279cb6f54f5e6074ff0f8319d830dafe',
    PRZWETH: '0x2998c1685e308661123f64b333767266035f5020',
    PRZDAI: '0x3e8dbe51da479f7e8ac46307af99ad5b4b5b41dc',
    PRZLUSD: '0x1f16d3ccf568e96019cedc8a2c79d2ca6257894e',
    PRZWSTETHETH: '0x9b4c0de59628c64b02d7ce86f21db9a579539d5a',
    PRZPOOLWETH: '0x9b53ef6f13077727d22cb4acad1119c79a97be17',
  },
  [CHAIN_IDS.base]: {
    POOL: '0xd652c5425aea2afd5fb142e120fecf79e18fafc3',
    WETH: '0x4200000000000000000000000000000000000006',
    USDC: '',
    DAI: '',
    LUSD: '',
    PRZUSDC: '',
    PRZWETH: '',
    PRZDAI: '',
    PRZLUSD: '',
  },
  [CHAIN_IDS.sepolia]: {
    POOL: '0x68a100a3729fc04ab26fb4c0862df22ceec2f18b',
    LINK: '0x779877a7b0d9e8603169ddbd7836e478b4624789',
  },
  [CHAIN_IDS.arbitrumSepolia]: {
    POOL: '0xf401d1482dfaa89a050f111992a222e9ad123e14',
    WBTC: '0x1bc266e1f397517ece9e384c55c7a5414b683639',
    WETH: '0x779275fc1b987db24463801f3708f42f3c6f6ceb',
    USDC: '0x7a6dbc7ff4f1a2d864291db3aec105a8eee4a3d2',
    DAI: '0x08c19fe57af150a1af975cb9a38769848c7df98e',
    GUSD: '0xb84460d777133a4b86540d557db35952e4adfee7',
    PDAILYT: '0x3adaa1d4f23c82130e1681c2ca9b38f5fb9a0892',
    PDAIHYT: '0x4dbf73fe0d23a6d275aefebc7c00600045ab8b9e',
    PUSDCLYT: '0xa723cf5d90c1a472c7de7285e5bd314aea107ede',
    PUSDCHYT: '0xb81b725b16e99c840ac17b396590da9c93c5bc3b',
    PWETH1: '0xe3235057ee444e9f53a5f41e66c03348c68b22c2',
    PWETH2: '0xa5905161eab67b6a13104537a09a949ef043366e',
  },
  [CHAIN_IDS.optimismSepolia]: {
    POOL: '0x24ffb8ca3dea588b267a15f1d94766dcba034ae6',
    DAI: '0xef38f21ec5477f6e3d4b7e9f0dea44a788c669b0',
    USDC: '0xded96a50515f1a4620a3c5244fae15ed7d216d4a',
    WETH: '0x4a61b6f54157840e80e0c47f1a628c0b3744a739',
    GUSD: '0x68f92539f64e486f2853bb2892933a21b54829e5',
    WBTC: '0x6c6a62b0861d8f2b946456ba9dcd0f3baec54147',
    PDAI: '0xe039683d5f9717d6f74d252722546cfedab32250',
    PUSDC: '0xcc255d71c57a5d5f92183a66b7fc5589151adcd0',
    PWETH: '0xed2f166ad10b247f67c3fce7a4c8e0c5e54247ea',
    PGUSD: '0xe1498d24a398b588b5e3f2c5d230991304203ad9',
    PWBTC: '0x02dda5914b78f0751fdf5bbe2050efabd95dff46',
  },
  [CHAIN_IDS.baseSepolia]: {
    POOL: '0x71b271952c3335e7258fbdcae5cd3a57e76b5b51',
    DAI: '0x82557c5157fcbeddd80ae09647ec018a0083a638',
    USDC: '0xc88130e55db4a3ba162984d6efe4ff982bc0e227',
    WETH: '0x41d7ddf285a08c74a4cb9fdc979c703b10c30ab1',
    GUSD: '0x431bf0fe8acb5c79c4f4fbc63f6de0756e928dd3',
    WBTC: '0x214e35ca60a828cc44fae2f2b97d37c116b02229',
    PDAI: '0x01f6351fe2651c411cd98910aae2adefcd034c59',
    PUSDC: '0xa51d2a8dd481800e9576aeb341340411b2b28679',
    PWETH: '0x137a5e9cf386ea09be2304f17052613609d24660',
    PGUSD: '0xed665c4c6ec4315131ea5266da4c3be4694d0615',
    PWBTC: '0x7ba33795f824c3494a7d8285e7cc20b83a7d7dba',
  },
};

export const LIQUIDATION_TOKEN_ALLOW_LIST = {
  [CHAIN_IDS.optimism]: [
    KNOWN_TOKENS[CHAIN_IDS.optimism].POOL.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.optimism].WETH.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.optimism].USDC.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.optimism].USDCE.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.optimism].DAI.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.optimism].LUSD.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.optimism].OP.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.optimism].PRZUSDC.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.optimism].PRZWETH.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.optimism].PRZDAI.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.optimism].PRZLUSD.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.optimism].PRZWSTETHETH.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.optimism].PRZPOOLWETH.toLowerCase(),
  ],
  [CHAIN_IDS.optimismSepolia]: [
    KNOWN_TOKENS[CHAIN_IDS.optimismSepolia].POOL.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.optimismSepolia].WBTC.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.optimismSepolia].WETH.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.optimismSepolia].USDC.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.optimismSepolia].DAI.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.optimismSepolia].PDAI.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.optimismSepolia].PUSDC.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.optimismSepolia].PGUSD.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.optimismSepolia].PWBTC.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.optimismSepolia].PWETH.toLowerCase(),
  ],
  [CHAIN_IDS.baseSepolia]: [
    KNOWN_TOKENS[CHAIN_IDS.baseSepolia].POOL.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.baseSepolia].WBTC.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.baseSepolia].WETH.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.baseSepolia].USDC.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.baseSepolia].DAI.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.baseSepolia].PDAI.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.baseSepolia].PUSDC.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.baseSepolia].PGUSD.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.baseSepolia].PWBTC.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.baseSepolia].PWETH.toLowerCase(),
  ],
  [CHAIN_IDS.arbitrumSepolia]: [
    KNOWN_TOKENS[CHAIN_IDS.arbitrumSepolia].POOL.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.arbitrumSepolia].USDC.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.arbitrumSepolia].DAI.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.arbitrumSepolia].PDAILYT.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.arbitrumSepolia].PDAIHYT.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.arbitrumSepolia].PUSDCLYT.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.arbitrumSepolia].PUSDCHYT.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.arbitrumSepolia].PWETH1.toLowerCase(),
    KNOWN_TOKENS[CHAIN_IDS.arbitrumSepolia].PWETH2.toLowerCase(),
  ],
};

const mainnetTokens = KNOWN_TOKENS[CHAIN_IDS.mainnet];
const optimismTokens = KNOWN_TOKENS[CHAIN_IDS.optimism];
const optimismSepoliaTokens = KNOWN_TOKENS[CHAIN_IDS.optimismSepolia];
const sepoliaTokens = KNOWN_TOKENS[CHAIN_IDS.sepolia];
const arbitrumSepoliaTokens = KNOWN_TOKENS[CHAIN_IDS.arbitrumSepolia];
const baseSepoliaTokens = KNOWN_TOKENS[CHAIN_IDS.baseSepolia];

export const ADDRESS_TO_COVALENT_LOOKUP = {
  [mainnetTokens.WETH.toLowerCase()]: mainnetTokens.WETH.toLowerCase(), // Ethereum WETH -> Ethereum WETH
  [sepoliaTokens.POOL.toLowerCase()]: mainnetTokens.POOL.toLowerCase(), // Sepolia POOL -> Ethereum POOL
  [arbitrumSepoliaTokens.POOL.toLowerCase()]: mainnetTokens.POOL.toLowerCase(), // Arb Sepolia POOL -> Ethereum POOL
  [optimismTokens.POOL.toLowerCase()]: mainnetTokens.POOL.toLowerCase(), // Optimism POOL -> Ethereum POOL
  [optimismSepoliaTokens.POOL.toLowerCase()]: mainnetTokens.POOL.toLowerCase(), // Optimism Sepolia POOL -> Ethereum POOL
  [baseSepoliaTokens.POOL.toLowerCase()]: mainnetTokens.POOL.toLowerCase(), // Base Sepolia POOL -> Ethereum POOL
  [sepoliaTokens.LINK.toLowerCase()]: mainnetTokens.LINK.toLowerCase(), // Sepolia LINK -> Ethereum LINK
  [arbitrumSepoliaTokens.WBTC.toLowerCase()]: mainnetTokens.WBTC.toLowerCase(), // Arb Sepolia WBTC -> Ethereum WBTC
  [arbitrumSepoliaTokens.WETH.toLowerCase()]: mainnetTokens.WETH.toLowerCase(), // Arb Sepolia WETH -> Ethereum WETH
  [optimismTokens.WETH.toLowerCase()]: mainnetTokens.WETH.toLowerCase(), // Optimism WETH -> Ethereum WETH
  [optimismSepoliaTokens.WBTC.toLowerCase()]: mainnetTokens.WBTC.toLowerCase(), // Optimism Sepolia WBTC -> Ethereum WETH
  [baseSepoliaTokens.WBTC.toLowerCase()]: mainnetTokens.WBTC.toLowerCase(), // Optimism Sepolia WBTC -> Ethereum WETH
  [optimismSepoliaTokens.WETH.toLowerCase()]: mainnetTokens.WETH.toLowerCase(), // Optimism Sepolia WETH -> Ethereum WBTC
  [baseSepoliaTokens.WETH.toLowerCase()]: mainnetTokens.WETH.toLowerCase(), // Optimism Sepolia WETH -> Ethereum WBTC
  [optimismTokens.USDC.toLowerCase()]: mainnetTokens.USDC.toLowerCase(), // Optimism USDC -> Ethereum USDC
  [optimismTokens.USDCE.toLowerCase()]: mainnetTokens.USDC.toLowerCase(), // Optimism USDC.e -> Ethereum USDC
  [arbitrumSepoliaTokens.USDC.toLowerCase()]: mainnetTokens.USDC.toLowerCase(), // Arb Sepolia USDC -> Ethereum USDC
  [optimismSepoliaTokens.USDC.toLowerCase()]: mainnetTokens.USDC.toLowerCase(), // Opt Sepolia USDC -> Ethereum USDC
  [baseSepoliaTokens.USDC.toLowerCase()]: mainnetTokens.USDC.toLowerCase(), // Opt Sepolia USDC -> Ethereum USDC
  [optimismTokens.DAI.toLowerCase()]: mainnetTokens.DAI.toLowerCase(), // Optimism DAI -> Ethereum DAI
  [arbitrumSepoliaTokens.DAI.toLowerCase()]: mainnetTokens.DAI.toLowerCase(), // Arb Sepolia DAI -> Ethereum DAI
  [optimismSepoliaTokens.DAI.toLowerCase()]: mainnetTokens.DAI.toLowerCase(), // Opt Sepolia DAI -> Ethereum DAI
  [baseSepoliaTokens.DAI.toLowerCase()]: mainnetTokens.DAI.toLowerCase(), // Opt Sepolia DAI -> Ethereum DAI
  [optimismSepoliaTokens.GUSD.toLowerCase()]: mainnetTokens.GUSD.toLowerCase(), // Opt Sepolia GUSD -> Ethereum GUSD
  [baseSepoliaTokens.GUSD.toLowerCase()]: mainnetTokens.GUSD.toLowerCase(), // Opt Sepolia GUSD -> Ethereum GUSD
  [arbitrumSepoliaTokens.GUSD.toLowerCase()]: mainnetTokens.GUSD.toLowerCase(), // Arb Sepolia GUSD -> Ethereum GUSD
  [optimismTokens.LUSD.toLowerCase()]: mainnetTokens.LUSD.toLowerCase(), // Optimism LUSD -> Ethereum LUSD
  [optimismTokens.OP.toLowerCase()]: mainnetTokens.OP.toLowerCase(), // Optimism OP -> Ethereum OP
};
