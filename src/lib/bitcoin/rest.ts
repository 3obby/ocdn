interface RestConfig {
  host: string;
  port: number;
}

export class BitcoinRest {
  private baseUrl: string;

  constructor(config?: Partial<RestConfig>) {
    const host = config?.host ?? process.env.BITCOIN_RPC_HOST ?? "127.0.0.1";
    const port = config?.port ?? Number(process.env.BITCOIN_RPC_PORT ?? "38332");
    this.baseUrl = `http://${host}:${port}/rest`;
  }

  async getBlockByHash(hash: string): Promise<RestBlock> {
    const res = await fetch(`${this.baseUrl}/block/${hash}.json`);
    if (!res.ok) throw new Error(`REST block ${hash}: HTTP ${res.status}`);
    return res.json() as Promise<RestBlock>;
  }

  async getBlockByHeight(height: number): Promise<RestBlock> {
    const hashRes = await fetch(`${this.baseUrl}/blockhashbyheight/${height}.json`);
    if (!hashRes.ok) throw new Error(`REST blockhash ${height}: HTTP ${hashRes.status}`);
    const { blockhash } = (await hashRes.json()) as { blockhash: string };
    return this.getBlockByHash(blockhash);
  }

  async getBlockHeaders(hash: string, count = 1): Promise<RestBlockHeader[]> {
    const res = await fetch(`${this.baseUrl}/headers/${count}/${hash}.json`);
    if (!res.ok) throw new Error(`REST headers ${hash}: HTTP ${res.status}`);
    return res.json() as Promise<RestBlockHeader[]>;
  }

  async getChainInfo(): Promise<RestChainInfo> {
    const res = await fetch(`${this.baseUrl}/chaininfo.json`);
    if (!res.ok) throw new Error(`REST chaininfo: HTTP ${res.status}`);
    return res.json() as Promise<RestChainInfo>;
  }

  async getTxOut(txid: string, n: number): Promise<RestTxOut | null> {
    const res = await fetch(`${this.baseUrl}/getutxos/${txid}-${n}.json`);
    if (!res.ok) return null;
    return res.json() as Promise<RestTxOut>;
  }
}

export interface RestBlock {
  hash: string;
  confirmations: number;
  height: number;
  version: number;
  merkleroot: string;
  time: number;
  mediantime: number;
  nonce: number;
  bits: string;
  difficulty: number;
  nTx: number;
  previousblockhash?: string;
  nextblockhash?: string;
  tx: RestTransaction[];
  size: number;
  weight: number;
}

export interface RestTransaction {
  txid: string;
  hash: string;
  version: number;
  size: number;
  vsize: number;
  weight: number;
  locktime: number;
  vin: RestTxInput[];
  vout: RestTxOutput[];
}

export interface RestTxInput {
  txid: string;
  vout: number;
  scriptSig: { asm: string; hex: string };
  txinwitness?: string[];
  sequence: number;
  prevout?: {
    generated: boolean;
    height: number;
    value: number;
    scriptPubKey: { asm: string; hex: string; type: string; address?: string };
  };
}

export interface RestTxOutput {
  value: number;
  n: number;
  scriptPubKey: { asm: string; hex: string; type: string; address?: string };
}

export interface RestBlockHeader {
  hash: string;
  confirmations: number;
  height: number;
  version: number;
  merkleroot: string;
  time: number;
  mediantime: number;
  nonce: number;
  bits: string;
  difficulty: number;
  nTx: number;
  previousblockhash?: string;
  nextblockhash?: string;
}

export interface RestChainInfo {
  chain: string;
  blocks: number;
  headers: number;
  bestblockhash: string;
  difficulty: number;
  verificationprogress: number;
  chainwork: string;
}

export interface RestTxOut {
  bestblock: string;
  confirmations: number;
  value: number;
  scriptPubKey: { asm: string; hex: string; type: string; address?: string };
  coinbase: boolean;
}

let restInstance: BitcoinRest | null = null;

export function getRest(config?: Partial<RestConfig>): BitcoinRest {
  if (!restInstance || config) {
    restInstance = new BitcoinRest(config);
  }
  return restInstance;
}
