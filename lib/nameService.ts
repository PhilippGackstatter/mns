import { instantiateClient } from "./utils";
import { NAME_SERVICE_ACCOUNT_ID, NODE_URL } from "./constants";
import { Account, AccountId, Felt, WebClient, Word } from "@demox-labs/miden-sdk";

const MAX_SYMBOL_LENGTH = 6; // per Felt
const FELTS_PER_WORD = 4;
const TOTAL_SYMBOL_LENGTH = MAX_SYMBOL_LENGTH * FELTS_PER_WORD; // 24
const MAX_CHARS_PER_FELT = 12;
const MAX_TOTAL_SYMBOL_LENGTH = MAX_CHARS_PER_FELT * (FELTS_PER_WORD - 1);
const ALPHABET_LENGTH = BigInt(26);
const A_CODE = "A".charCodeAt(0);

type DecodeResult = string;


// Encodes a string into 4 Felts
export function encodeName(s: string): Word {
  if (s.length === 0 || s.length > MAX_TOTAL_SYMBOL_LENGTH) {
    throw new Error(`InvalidLength: ${s.length}`);
  }
  if ([...s].some(c => c < "A" || c > "Z")) {
    throw new Error(`InvalidCharacter: ${s}`);
  }

  const felts: bigint[] = [BigInt(0), BigInt(0), BigInt(0), BigInt(0)];

  // First Felt stores the length
  felts[0] = BigInt(s.length);

  // Encode characters across the remaining 3 Felts
  let currentFelt = 1;
  let encoded = BigInt(0);
  let capacity = 0;

  for (const char of s) {
    const digit = BigInt(char.charCodeAt(0) - A_CODE);
    encoded = encoded * ALPHABET_LENGTH + digit;
    capacity++;

    // If this Felt is "full", move to next
    // Rule of thumb: about 16 chars per Felt at base-26 fits comfortably
    if (capacity >= MAX_CHARS_PER_FELT && currentFelt < FELTS_PER_WORD) {
      felts[currentFelt] = encoded;
      currentFelt++;
      encoded = BigInt(0);
      capacity = 0;
    }
  }

  // Store the last partially filled Felt
  if (currentFelt < FELTS_PER_WORD) {
    felts[currentFelt] = encoded;
  }

  return Word.newFromFelts(felts.map(f => new Felt(f)));
}

export async function registerName(name: string, accountId: AccountId): Promise<string> {
  if (typeof window === "undefined") {
    console.warn("registerName() can only run in the browser");
    return "";
  }

  // Encode symbol to field elements
  const encodedWord = encodeName(name.toUpperCase());

  const nameServiceCode = `
use.miden::account
use.miden::tx
use.std::word

const.NAME_MAP_SLOT_IDX=0

#! Registers the provided name in the contract.
#!
#! Inputs:  [NAME, ACCOUNT_ID, pad(8)]
#! Outputs: [pad(16)]
#!
#! Panics if:
#! - The provided name is already registered.
export.register
    swapw
    # => [ACCOUNT_ID, NAME, pad(8)]

    exec.word::testz assertz.err="account ID to be registered must not be empty"
    swapw
    # => [NAME, ACCOUNT_ID, pad(8)]

    push.NAME_MAP_SLOT_IDX
    # => [index, NAME, ACCOUNT_ID, pad(8)]

    exec.account::set_map_item dropw
    # => [PREV_VALUE, pad(8)]

    exec.word::eqz assert.err="name is already registered"
    # => [pad(8)]
end
`;

  // Dynamic import to ensure client-side execution
  const {
    AssemblerUtils,
    TransactionKernel,
    TransactionRequestBuilder,
    TransactionScript,
  } = await import("@demox-labs/miden-sdk");

  const client = await WebClient.createClient(NODE_URL);

  // Import the name service account into the client to be able to execute transactions against it,
  // unless it is already imported.
  if (!await client.getAccount(NAME_SERVICE_ACCOUNT_ID)) {
    await client.importAccountById(NAME_SERVICE_ACCOUNT_ID);
  }
  await client.syncState()

  console.log("Created client and imported name service account");

  // Build the transaction script
  let assembler = TransactionKernel.assembler().withDebugMode(true);

  // Create the library to call the name service contract
  const nameServiceLib = AssemblerUtils.createAccountComponentLibrary(
    assembler,
    "name_service::code",
    nameServiceCode,
  );

  const transactionScriptCode = `
    begin
        push.0.0.${accountId.suffix()}.${accountId.prefix()}
        push.${encodedWord.toHex()}
        # => [NAME, ACCOUNT_ID]
        call.::name_service::code::register
        dropw dropw
    end
`;

  console.log(transactionScriptCode)
  // Creating the transaction script
  const transactionScript = TransactionScript.compile(
    transactionScriptCode,
    assembler.withLibrary(nameServiceLib),
  );

  console.log("Compiled transaction script");

  // Creating a transaction request with the transaction script
  const transactionRequest = new TransactionRequestBuilder()
    .withCustomScript(transactionScript)
    .withScriptArg(encodedWord)
    .build();

  console.log("Built transaction request");

  // Executing the transaction script against the name service contract
  const txResult = await client.newTransaction(
    NAME_SERVICE_ACCOUNT_ID,
    transactionRequest,
  );

  console.log("Executed transaction");

  // Submitting the transaction result to the node
  await client.submitTransaction(txResult);

  console.log(`Submitted transaction ${txResult.executedTransaction().id().toHex()}`);

  // Sync state
  await client.syncState();

  console.log("Synced state");

  // Return success message with transaction info
  return `Name registration submitted successfully`;
}
