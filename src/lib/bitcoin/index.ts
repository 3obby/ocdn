export { BitcoinRpc, getRpc } from "./rpc";
export type {
  BlockchainInfo,
  Block,
  BlockVerbose,
  RawTransaction,
  TxInput,
  TxOutput,
  ScriptPubKey,
  FeeEstimate,
  MempoolInfo,
  NetworkInfo,
  UnspentOutput,
  MempoolAcceptResult,
  PackageResult,
} from "./rpc";

export { BitcoinRest, getRest } from "./rest";
export type {
  RestBlock,
  RestTransaction,
  RestTxInput,
  RestTxOutput,
  RestBlockHeader,
  RestChainInfo,
  RestTxOut,
} from "./rest";
