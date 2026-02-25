interface RpcConfig {
  host: string;
  port: number;
  user: string;
  password: string;
}

interface RpcResponse<T> {
  result: T;
  error: { code: number; message: string } | null;
  id: string;
}

export class BitcoinRpc {
  private url: string;
  private auth: string;
  private idCounter = 0;

  constructor(config?: Partial<RpcConfig>) {
    const host = config?.host ?? process.env.BITCOIN_RPC_HOST ?? "127.0.0.1";
    const port = config?.port ?? Number(process.env.BITCOIN_RPC_PORT ?? "38332");
    const user = config?.user ?? process.env.BITCOIN_RPC_USER ?? "ocdn";
    const password = config?.password ?? process.env.BITCOIN_RPC_PASSWORD ?? "";

    this.url = `http://${host}:${port}`;
    this.auth = "Basic " + Buffer.from(`${user}:${password}`).toString("base64");
  }

  private async call<T>(method: string, params: unknown[] = []): Promise<T> {
    const id = `ocdn-${++this.idCounter}`;
    const body = JSON.stringify({ jsonrpc: "1.0", id, method, params });

    const res = await fetch(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.auth,
      },
      body,
    });

    if (!res.ok) {
      throw new Error(`Bitcoin RPC HTTP ${res.status}: ${await res.text()}`);
    }

    const json = (await res.json()) as RpcResponse<T>;
    if (json.error) {
      throw new Error(`Bitcoin RPC error ${json.error.code}: ${json.error.message}`);
    }
    return json.result;
  }

  // ═══ BLOCKCHAIN INFO ═══

  async getBlockchainInfo(): Promise<BlockchainInfo> {
    return this.call<BlockchainInfo>("getblockchaininfo");
  }

  async getBlockCount(): Promise<number> {
    return this.call<number>("getblockcount");
  }

  async getBestBlockHash(): Promise<string> {
    return this.call<string>("getbestblockhash");
  }

  async getBlockHash(height: number): Promise<string> {
    return this.call<string>("getblockhash", [height]);
  }

  async getBlock(hashOrHeight: string | number, verbosity: 0): Promise<string>;
  async getBlock(hashOrHeight: string | number, verbosity?: 1): Promise<Block>;
  async getBlock(hashOrHeight: string | number, verbosity: 2): Promise<BlockVerbose>;
  async getBlock(hashOrHeight: string | number, verbosity: 3): Promise<BlockVerbose>;
  async getBlock(hashOrHeight: string | number, verbosity = 1) {
    const hash =
      typeof hashOrHeight === "number"
        ? await this.getBlockHash(hashOrHeight)
        : hashOrHeight;
    return this.call("getblock", [hash, verbosity]);
  }

  // ═══ TRANSACTIONS ═══

  async getRawTransaction(txid: string, verbose?: false): Promise<string>;
  async getRawTransaction(txid: string, verbose: true): Promise<RawTransaction>;
  async getRawTransaction(txid: string, verbose = false) {
    return this.call("getrawtransaction", [txid, verbose]);
  }

  async sendRawTransaction(hex: string): Promise<string> {
    return this.call<string>("sendrawtransaction", [hex]);
  }

  async testMempoolAccept(rawtxs: string[]): Promise<MempoolAcceptResult[]> {
    return this.call<MempoolAcceptResult[]>("testmempoolaccept", [rawtxs]);
  }

  // ═══ FEE ESTIMATION ═══

  async estimateSmartFee(confTarget: number): Promise<FeeEstimate> {
    return this.call<FeeEstimate>("estimatesmartfee", [confTarget]);
  }

  async getMempoolInfo(): Promise<MempoolInfo> {
    return this.call<MempoolInfo>("getmempoolinfo");
  }

  // ═══ NETWORK ═══

  async getNetworkInfo(): Promise<NetworkInfo> {
    return this.call<NetworkInfo>("getnetworkinfo");
  }

  // ═══ WALLET (for portal UTXO management) ═══

  async listUnspent(minConf?: number, maxConf?: number): Promise<UnspentOutput[]> {
    return this.call<UnspentOutput[]>("listunspent", [minConf ?? 1, maxConf ?? 9999999]);
  }

  // ═══ UTILITY ═══

  async decodeRawTransaction(hex: string): Promise<RawTransaction> {
    return this.call<RawTransaction>("decoderawtransaction", [hex]);
  }

  async submitPackage(rawtxs: string[]): Promise<PackageResult> {
    return this.call<PackageResult>("submitpackage", [rawtxs]);
  }

  async ping(): Promise<boolean> {
    try {
      await this.call("getblockchaininfo");
      return true;
    } catch {
      return false;
    }
  }
}

// ═══ TYPE DEFINITIONS ═══

export interface BlockchainInfo {
  chain: string;
  blocks: number;
  headers: number;
  bestblockhash: string;
  difficulty: number;
  time: number;
  mediantime: number;
  verificationprogress: number;
  initialblockdownload: boolean;
  chainwork: string;
  size_on_disk: number;
  pruned: boolean;
  warnings: string[];
}

export interface Block {
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
  tx: string[];
  size: number;
  weight: number;
}

export interface BlockVerbose extends Omit<Block, "tx"> {
  tx: RawTransaction[];
}

export interface RawTransaction {
  txid: string;
  hash: string;
  version: number;
  size: number;
  vsize: number;
  weight: number;
  locktime: number;
  vin: TxInput[];
  vout: TxOutput[];
  hex?: string;
  blockhash?: string;
  confirmations?: number;
  time?: number;
  blocktime?: number;
}

export interface TxInput {
  txid: string;
  vout: number;
  scriptSig: { asm: string; hex: string };
  txinwitness?: string[];
  sequence: number;
  prevout?: {
    generated: boolean;
    height: number;
    value: number;
    scriptPubKey: ScriptPubKey;
  };
}

export interface TxOutput {
  value: number;
  n: number;
  scriptPubKey: ScriptPubKey;
}

export interface ScriptPubKey {
  asm: string;
  hex: string;
  type: string;
  address?: string;
}

export interface FeeEstimate {
  feerate?: number;
  errors?: string[];
  blocks: number;
}

export interface MempoolInfo {
  loaded: boolean;
  size: number;
  bytes: number;
  usage: number;
  total_fee: number;
  maxmempool: number;
  mempoolminfee: number;
  minrelaytxfee: number;
}

export interface NetworkInfo {
  version: number;
  subversion: string;
  protocolversion: number;
  connections: number;
  connections_in: number;
  connections_out: number;
  localservicesnames: string[];
  relayfee: number;
}

export interface UnspentOutput {
  txid: string;
  vout: number;
  address: string;
  scriptPubKey: string;
  amount: number;
  confirmations: number;
  spendable: boolean;
  solvable: boolean;
}

export interface MempoolAcceptResult {
  txid: string;
  allowed: boolean;
  "reject-reason"?: string;
}

export interface PackageResult {
  package_msg: string;
  tx_results: Record<string, { txid: string; error?: string }>;
}

let rpcInstance: BitcoinRpc | null = null;

export function getRpc(config?: Partial<RpcConfig>): BitcoinRpc {
  if (!rpcInstance || config) {
    rpcInstance = new BitcoinRpc(config);
  }
  return rpcInstance;
}
