export { runIndexer } from "./scanner";
export type { IndexerConfig } from "./scanner";

export { processBlock } from "./processor";
export type { ProcessedBlock } from "./processor";

export {
  getIndexerState,
  updateIndexerState,
  handleReorg,
  rewindToHeight,
} from "./reorg";
export type { ChainTip } from "./reorg";

export {
  detectBlockItems,
  extractWitnessEnvelopes,
  extractOpReturns,
  parseScriptForEnvelopes,
  extractOpReturnData,
  computeTxFee,
  extractSignerPubkey,
  normalizeTopic,
  normalizedTopicHash,
  toHex,
  fromHex,
} from "./detector";
export type {
  DetectedEnvelope,
  DetectedOpReturn,
  BlockItems,
} from "./detector";
