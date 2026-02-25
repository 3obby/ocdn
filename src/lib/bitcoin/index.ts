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

export {
  NETWORK,
  DUST_LIMIT,
  RBF_SEQUENCE,
  loadPortalKey,
  generatePortalKey,
  createKeyPathSigner,
  createScriptPathSigner,
  getAvailableUtxos,
  reserveUtxo,
  releaseUtxo,
  markUtxoSpent,
  addUtxo,
  releaseStaleReservations,
} from "./wallet";
export type { PortalKey, TaprootSigner, PoolUtxo } from "./wallet";

export {
  buildEnvelopeScript,
  buildCommitRevealTxs,
  buildKeyPathRecoveryTx,
  buildBurnTx,
  buildSignalTx,
  buildFanOutTx,
  buildConsolidationTx,
  buildRbfBump,
  bumpCommitReveal,
  estimateKeyPathTxVsize,
  estimateRevealVsize,
  estimateCommitRevealCost,
  estimateBurnCost,
  estimateSignalCost,
  broadcastCommitReveal,
  broadcastTx,
  testMempoolAccept,
  diagnoseCommitReveal,
  diagnoseSingleTx,
} from "./tx";
export type {
  UtxoInput,
  CommitRevealResult,
  SingleTxResult,
  CostEstimate,
  SingleTxCostEstimate,
  RetryAction,
  PendingTxStatus,
} from "./tx";
