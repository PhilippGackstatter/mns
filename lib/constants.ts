import { AccountId } from "@demox-labs/miden-sdk";

export const NODE_URL = "https://rpc.testnet.miden.io:443";
// Replace with the actual name service account ID from deployment.
export const NAME_SERVICE_ACCOUNT_ID = AccountId.fromHex("0xa15235a414026f10138ca845f2ae8f");
export const NAME_MAP_SLOT_IDX = 0

export const FELTS_PER_WORD = 4;
export const MAX_CHARS_PER_FELT = 12;
export const MAX_TOTAL_NAME_LENGTH = MAX_CHARS_PER_FELT * (FELTS_PER_WORD - 1);
export const ALPHABET_LENGTH = BigInt(26);
export const A_CODE = "a".charCodeAt(0);

