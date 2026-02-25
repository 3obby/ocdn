export type Post = {
  id: string;
  contentHash: string;
  protocol: string;
  authorPubkey: string;
  text: string;
  topicHash: string | null;
  topicName: string | null;
  parentId: string | null;
  burnTotal: number;
  timestamp: number;
  blockHeight: number;
  confirmations: number;
};

export type Topic = {
  hash: string;
  name: string | null;
  totalBurned: number;
};

export function topicLabel(t: Topic): string {
  return t.name ?? t.hash.slice(0, 8);
}

export type ThreadItem = Post & { depth: number };

export type TopicGroup = {
  topic: Topic | null;
  posts: Post[];
};

const NOW = Date.now();
const H = 3_600_000;
const D = 86_400_000;

export const TOPICS: Topic[] = [
  { hash: "a1b2c3d4", name: "bitcoin", totalBurned: 2_847_000 },
  { hash: "e5f6a7b8", name: "free-speech", totalBurned: 1_923_000 },
  { hash: "c9d0e1f2", name: "censorship", totalBurned: 1_456_000 },
  { hash: "a3b4c5d6", name: "economics", totalBurned: 982_000 },
  { hash: "e7f8a9b0", name: "privacy", totalBurned: 745_000 },
  { hash: "c1d2e3f4", name: "technology", totalBurned: 523_000 },
  { hash: "a5b6c7d8", name: "governance", totalBurned: 312_000 },
  { hash: "f4a29c81", name: null, totalBurned: 187_000 },
  { hash: "3e7b0d5f", name: null, totalBurned: 94_000 },
  { hash: "d19e4a72", name: null, totalBurned: 61_000 },
  { hash: "8c03f6b1", name: null, totalBurned: 28_000 },
  { hash: "a72d1e9f", name: null, totalBurned: 12_000 },
];

const topicMap = new Map(TOPICS.map((t) => [t.hash, t]));

export const POSTS: Post[] = [
  // ── bitcoin ────────────────────────────────────────
  {
    id: "p01",
    contentHash: "f8e7d6c5b4a39281",
    protocol: "ocdn",
    authorPubkey:
      "02a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1",
    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.",
    topicHash: "a1b2c3d4",
    topicName: "bitcoin",
    parentId: null,
    burnTotal: 42_100,
    timestamp: NOW - 2 * H,
    blockHeight: 892_451,
    confirmations: 12,
  },
  {
    id: "p02",
    contentHash: "a9b8c7d6e5f4a3b2",
    protocol: "ocdn",
    authorPubkey:
      "03b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
    text: "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    topicHash: "a1b2c3d4",
    topicName: "bitcoin",
    parentId: "p01",
    burnTotal: 8_300,
    timestamp: NOW - 1.5 * H,
    blockHeight: 892_453,
    confirmations: 10,
  },
  {
    id: "p03",
    contentHash: "c1d2e3f4a5b6c7d8",
    protocol: "ocdn",
    authorPubkey:
      "02d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4",
    text: "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
    topicHash: "a1b2c3d4",
    topicName: "bitcoin",
    parentId: "p02",
    burnTotal: 2_100,
    timestamp: NOW - 1 * H,
    blockHeight: 892_456,
    confirmations: 6,
  },
  {
    id: "p04",
    contentHash: "e3f4a5b6c7d8e9f0",
    protocol: "ocdn",
    authorPubkey:
      "03f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6",
    text: "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
    topicHash: "a1b2c3d4",
    topicName: "bitcoin",
    parentId: "p03",
    burnTotal: 890,
    timestamp: NOW - 45 * 60_000,
    blockHeight: 892_458,
    confirmations: 4,
  },
  {
    id: "p05",
    contentHash: "b4a39281f8e7d6c5",
    protocol: "ocdn",
    authorPubkey:
      "02a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1",
    text: "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.",
    topicHash: "a1b2c3d4",
    topicName: "bitcoin",
    parentId: "p01",
    burnTotal: 5_400,
    timestamp: NOW - 50 * 60_000,
    blockHeight: 892_457,
    confirmations: 5,
  },
  {
    id: "p06",
    contentHash: "d6c5b4a39281f8e7",
    protocol: "ocdn",
    authorPubkey:
      "03c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9",
    text: "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.",
    topicHash: "a1b2c3d4",
    topicName: "bitcoin",
    parentId: null,
    burnTotal: 18_200,
    timestamp: NOW - 5 * H,
    blockHeight: 892_440,
    confirmations: 30,
  },
  {
    id: "p07",
    contentHash: "9281f8e7d6c5b4a3",
    protocol: "ocdn",
    authorPubkey:
      "02e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1",
    text: "Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet.",
    topicHash: "a1b2c3d4",
    topicName: "bitcoin",
    parentId: "p06",
    burnTotal: 3_100,
    timestamp: NOW - 4 * H,
    blockHeight: 892_444,
    confirmations: 22,
  },

  // ── free-speech ────────────────────────────────────
  {
    id: "p08",
    contentHash: "1a2b3c4d5e6f7a8b",
    protocol: "ocdn",
    authorPubkey:
      "03a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7",
    text: "Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur.",
    topicHash: "e5f6a7b8",
    topicName: "free-speech",
    parentId: null,
    burnTotal: 35_600,
    timestamp: NOW - 3 * H,
    blockHeight: 892_448,
    confirmations: 18,
  },
  {
    id: "p09",
    contentHash: "2b3c4d5e6f7a8b1a",
    protocol: "ocdn",
    authorPubkey:
      "02b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8",
    text: "Vel illum qui dolorem eum fugiat quo voluptas nulla pariatur.",
    topicHash: "e5f6a7b8",
    topicName: "free-speech",
    parentId: "p08",
    burnTotal: 12_400,
    timestamp: NOW - 2.5 * H,
    blockHeight: 892_449,
    confirmations: 15,
  },
  {
    id: "p10",
    contentHash: "3c4d5e6f7a8b1a2b",
    protocol: "ocdn",
    authorPubkey:
      "03c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9",
    text: "At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium.",
    topicHash: "e5f6a7b8",
    topicName: "free-speech",
    parentId: "p09",
    burnTotal: 4_200,
    timestamp: NOW - 2 * H,
    blockHeight: 892_451,
    confirmations: 12,
  },
  {
    id: "p11",
    contentHash: "4d5e6f7a8b1a2b3c",
    protocol: "ocdn",
    authorPubkey:
      "02d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0",
    text: "Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet.",
    topicHash: "e5f6a7b8",
    topicName: "free-speech",
    parentId: "p10",
    burnTotal: 1_800,
    timestamp: NOW - 1.5 * H,
    blockHeight: 892_453,
    confirmations: 10,
  },
  {
    id: "p12",
    contentHash: "5e6f7a8b1a2b3c4d",
    protocol: "ocdn",
    authorPubkey:
      "03e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1",
    text: "Itaque earum rerum hic tenetur a sapiente delectus.",
    topicHash: "e5f6a7b8",
    topicName: "free-speech",
    parentId: "p10",
    burnTotal: 2_600,
    timestamp: NOW - 1.2 * H,
    blockHeight: 892_454,
    confirmations: 8,
  },
  {
    id: "p13",
    contentHash: "6f7a8b1a2b3c4d5e",
    protocol: "ocdn",
    authorPubkey:
      "02f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2",
    text: "Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit.",
    topicHash: "e5f6a7b8",
    topicName: "free-speech",
    parentId: null,
    burnTotal: 12_300,
    timestamp: NOW - 8 * H,
    blockHeight: 892_430,
    confirmations: 48,
  },

  // ── censorship ─────────────────────────────────────
  {
    id: "p14",
    contentHash: "7a8b1a2b3c4d5e6f",
    protocol: "ocdn",
    authorPubkey:
      "03a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3",
    text: "Omnis voluptas assumenda est, omnis dolor repellendus.",
    topicHash: "c9d0e1f2",
    topicName: "censorship",
    parentId: null,
    burnTotal: 28_700,
    timestamp: NOW - 6 * H,
    blockHeight: 892_438,
    confirmations: 36,
  },
  {
    id: "p15",
    contentHash: "8b1a2b3c4d5e6f7a",
    protocol: "ocdn",
    authorPubkey:
      "02b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4",
    text: "Similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga.",
    topicHash: "c9d0e1f2",
    topicName: "censorship",
    parentId: "p14",
    burnTotal: 6_500,
    timestamp: NOW - 5.5 * H,
    blockHeight: 892_439,
    confirmations: 33,
  },
  {
    id: "p16",
    contentHash: "1a2b3c4d5e6f7a8c",
    protocol: "ocdn",
    authorPubkey:
      "03c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5",
    text: "Et harum quidem rerum facilis est et expedita distinctio.",
    topicHash: "c9d0e1f2",
    topicName: "censorship",
    parentId: null,
    burnTotal: 15_100,
    timestamp: NOW - 1 * D,
    blockHeight: 892_310,
    confirmations: 144,
  },

  // ── economics ──────────────────────────────────────
  {
    id: "p17",
    contentHash: "2b3c4d5e6f7a8b1b",
    protocol: "ocdn",
    authorPubkey:
      "02d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
    text: "Nisi ut aliquid ex ea commodi consequatur, quis autem vel eum iure.",
    topicHash: "a3b4c5d6",
    topicName: "economics",
    parentId: null,
    burnTotal: 21_400,
    timestamp: NOW - 4 * H,
    blockHeight: 892_444,
    confirmations: 24,
  },
  {
    id: "p18",
    contentHash: "3c4d5e6f7a8b1a2c",
    protocol: "ocdn",
    authorPubkey:
      "03e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7",
    text: "Reprehenderit qui in ea voluptate velit esse quam nihil.",
    topicHash: "a3b4c5d6",
    topicName: "economics",
    parentId: "p17",
    burnTotal: 4_800,
    timestamp: NOW - 3.5 * H,
    blockHeight: 892_446,
    confirmations: 20,
  },

  // ── privacy ────────────────────────────────────────
  {
    id: "p19",
    contentHash: "4d5e6f7a8b1a2b3d",
    protocol: "ocdn",
    authorPubkey:
      "02f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8",
    text: "Molestiae non recusandae ipsa quae ab illo inventore veritatis et quasi architecto.",
    topicHash: "e7f8a9b0",
    topicName: "privacy",
    parentId: null,
    burnTotal: 9_200,
    timestamp: NOW - 7 * H,
    blockHeight: 892_435,
    confirmations: 42,
  },

  // ── technology ─────────────────────────────────────
  {
    id: "p20",
    contentHash: "5e6f7a8b1a2b3c4e",
    protocol: "ocdn",
    authorPubkey:
      "03a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9",
    text: "Beatae vitae dicta sunt explicabo nemo enim ipsam voluptatem.",
    topicHash: "c1d2e3f4",
    topicName: "technology",
    parentId: null,
    burnTotal: 7_300,
    timestamp: NOW - 10 * H,
    blockHeight: 892_420,
    confirmations: 60,
  },

  // ── governance ─────────────────────────────────────
  {
    id: "p21",
    contentHash: "6f7a8b1a2b3c4d5f",
    protocol: "ocdn",
    authorPubkey:
      "02b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
    text: "Totam rem aperiam eaque ipsa quae ab illo inventore veritatis.",
    topicHash: "a5b6c7d8",
    topicName: "governance",
    parentId: null,
    burnTotal: 5_100,
    timestamp: NOW - 12 * H,
    blockHeight: 892_410,
    confirmations: 72,
  },

  // ── raw / external protocol content ─────────────────
  {
    id: "p24",
    contentHash: "ae12bf34cd56ef78",
    protocol: "ocdn",
    authorPubkey:
      "02e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3",
    text: "The Times 03/Jan/2009 Chancellor on brink of second bailout for banks",
    topicHash: "f4a29c81",
    topicName: null,
    parentId: null,
    burnTotal: 91_000,
    timestamp: NOW - 2 * D,
    blockHeight: 891_200,
    confirmations: 1250,
  },
  {
    id: "p25",
    contentHash: "bf34cd56ef78ae12",
    protocol: "ocdn",
    authorPubkey:
      "03f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4",
    text: "Sapere aude",
    topicHash: "f4a29c81",
    topicName: null,
    parentId: null,
    burnTotal: 44_000,
    timestamp: NOW - 3 * D,
    blockHeight: 890_800,
    confirmations: 1650,
  },
  {
    id: "p26",
    contentHash: "cd56ef78ae12bf34",
    protocol: "ocdn",
    authorPubkey:
      "02a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5",
    text: "Veritas numquam perit",
    topicHash: "3e7b0d5f",
    topicName: null,
    parentId: null,
    burnTotal: 52_000,
    timestamp: NOW - 4 * D,
    blockHeight: 890_400,
    confirmations: 2050,
  },
  {
    id: "p27",
    contentHash: "ef78ae12bf34cd56",
    protocol: "ocdn",
    authorPubkey:
      "03b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6",
    text: "u/deadalnix is mass-censoring discussion about BTC on r/btc",
    topicHash: "3e7b0d5f",
    topicName: null,
    parentId: null,
    burnTotal: 31_000,
    timestamp: NOW - 5 * D,
    blockHeight: 890_000,
    confirmations: 2450,
  },
  {
    id: "p28",
    contentHash: "12bf34cd56ef78ae",
    protocol: "ocdn",
    authorPubkey:
      "02c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7",
    text: "We hold these truths to be self-evident",
    topicHash: "d19e4a72",
    topicName: null,
    parentId: null,
    burnTotal: 61_000,
    timestamp: NOW - 6 * D,
    blockHeight: 889_600,
    confirmations: 2850,
  },

  // ── standalone (no topic) ──────────────────────────
  {
    id: "p22",
    contentHash: "7a8b1a2b3c4d5e6g",
    protocol: "ocdn",
    authorPubkey:
      "03c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1",
    text: "Inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.",
    topicHash: null,
    topicName: null,
    parentId: null,
    burnTotal: 3_400,
    timestamp: NOW - 30 * 60_000,
    blockHeight: 892_459,
    confirmations: 3,
  },
  {
    id: "p23",
    contentHash: "8b1a2b3c4d5e6f7b",
    protocol: "ocdn",
    authorPubkey:
      "02d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2",
    text: "Accusantium doloremque laudantium totam rem aperiam.",
    topicHash: null,
    topicName: null,
    parentId: null,
    burnTotal: 1_200,
    timestamp: NOW - 15 * 60_000,
    blockHeight: 892_460,
    confirmations: 2,
  },
];

// ── helpers ──────────────────────────────────────────

const postMap = new Map(POSTS.map((p) => [p.id, p]));

function getChildren(parentId: string): Post[] {
  return POSTS.filter((p) => p.parentId === parentId).sort(
    (a, b) => a.timestamp - b.timestamp,
  );
}

function getAncestors(postId: string): Post[] {
  const ancestors: Post[] = [];
  let current = postMap.get(postId);
  while (current?.parentId) {
    const parent = postMap.get(current.parentId);
    if (!parent) break;
    ancestors.unshift(parent);
    current = parent;
  }
  return ancestors;
}

function flattenDescendants(postId: string, depth: number): ThreadItem[] {
  const items: ThreadItem[] = [];
  for (const child of getChildren(postId)) {
    items.push({ ...child, depth });
    items.push(...flattenDescendants(child.id, depth + 1));
  }
  return items;
}

export function buildThread(postId: string): ThreadItem[] {
  const post = postMap.get(postId);
  if (!post) return [];

  const ancestors = getAncestors(postId);
  const items: ThreadItem[] = [];

  for (let i = 0; i < ancestors.length; i++) {
    items.push({ ...ancestors[i], depth: i });
  }

  const selfDepth = ancestors.length;
  items.push({ ...post, depth: selfDepth });
  items.push(...flattenDescendants(postId, selfDepth + 1));

  return items;
}

export type SortMode = "topics" | "new" | "top";

export function getGroupedFeed(topicFilter?: string | null): TopicGroup[] {
  if (topicFilter) {
    const topic = topicMap.get(topicFilter) ?? null;
    const posts = POSTS.filter((p) => p.topicHash === topicFilter).sort(
      (a, b) => b.burnTotal - a.burnTotal,
    );
    return [{ topic, posts }];
  }

  const groups: TopicGroup[] = [];

  for (const topic of TOPICS) {
    const posts = POSTS.filter(
      (p) => p.topicHash === topic.hash && p.parentId === null,
    )
      .sort((a, b) => b.burnTotal - a.burnTotal)
      .slice(0, 3);
    if (posts.length > 0) {
      groups.push({ topic, posts });
    }
  }

  const standalone = POSTS.filter(
    (p) => !p.topicHash && p.parentId === null,
  ).sort((a, b) => b.burnTotal - a.burnTotal);
  if (standalone.length > 0) {
    groups.push({ topic: null, posts: standalone.slice(0, 3) });
  }

  return groups;
}

export function getFlatFeed(
  sort: "new" | "top",
  topicFilter?: string | null,
): Post[] {
  let posts = topicFilter
    ? POSTS.filter((p) => p.topicHash === topicFilter)
    : [...POSTS];

  if (sort === "new") {
    posts.sort((a, b) => b.timestamp - a.timestamp);
  } else {
    posts.sort((a, b) => b.burnTotal - a.burnTotal);
  }
  return posts;
}

export function getPostById(id: string): Post | undefined {
  return postMap.get(id);
}

export function formatSats(sats: number): string {
  if (sats >= 1_000_000) return `${(sats / 1_000_000).toFixed(1)}M`;
  if (sats >= 10_000) return `${Math.round(sats / 1_000)}K`;
  if (sats >= 1_000) return `${(sats / 1_000).toFixed(1)}K`;
  return String(sats);
}

export function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

export function shortPubkey(pubkey: string): string {
  return pubkey.slice(-7);
}
