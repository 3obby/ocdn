export const PROTOCOL_TAG = "ocdn";
export const PROTOCOL_TAG_BYTES = new Uint8Array([0x6f, 0x63, 0x64, 0x6e]);
export const PROTOCOL_VERSION = 0x01;

export const TYPE_POST = 0x01;
export const TYPE_REPLY = 0x02;
export const TYPE_BURN = 0x03;
export const TYPE_EDIT = 0x04;
export const TYPE_BATCH = 0x05;
export const TYPE_SIGNAL = 0x06;

export const NONCE_LENGTH = 8;
export const PUBKEY_LENGTH = 32;
export const SIG_LENGTH = 64;
export const HASH_LENGTH = 32;
export const CONTENT_HASH_PREFIX_LENGTH = 8;

export const NULL_PARENT_REF = new Uint8Array(32);

export const MAX_DATA_PUSH = 520;

export const TAGGED_HASH_DOMAIN_CONTENT = "ocdn/content";
export const TAGGED_HASH_DOMAIN_TOPIC = "ocdn/topic";
export const TAGGED_HASH_DOMAIN_SIGN = "ocdn/sign";
