use anyhow::Context;
use miden_lib::account::auth::NoAuth;
use rand::{RngCore, rngs::StdRng};
use std::{fs, sync::Arc};

use miden_assembly::diagnostics::NamedSource;
use miden_client::{
    Client, DebugMode, ScriptBuilder,
    account::{
        AccountBuilder, AccountIdAddress, AccountStorageMode, AccountType, Address,
        AddressInterface, StorageSlot,
    },
    builder::ClientBuilder,
    keystore::FilesystemKeyStore,
    rpc::{Endpoint, TonicRpcClient},
    transaction::{TransactionKernel, TransactionRequestBuilder},
};
use miden_objects::{
    account::{AccountComponent, NetworkId},
    assembly::Assembler,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let endpoint = Endpoint::testnet();
    let timeout_ms = 10_000;
    let rpc_api = Arc::new(TonicRpcClient::new(&endpoint, timeout_ms));

    let mut client: Client<FilesystemKeyStore<StdRng>> = ClientBuilder::new()
        .rpc(rpc_api)
        .filesystem_keystore("./keystore")
        .in_debug_mode(DebugMode::Enabled)
        .build()
        .await?;

    let sync_summary = client.sync_state().await?;
    println!("Latest block: {}", sync_summary.block_num);

    println!("\n[STEP 1] Creating name service account.");

    let assembler: Assembler = TransactionKernel::assembler().with_debug_mode(true);

    let name_service_code = fs::read_to_string("../masm/accounts/name_service.masm")?;
    let name_service_code = NamedSource::new("name_service::code", name_service_code);

    let name_service_component =
        AccountComponent::compile(name_service_code, assembler, vec![StorageSlot::empty_map()])?
            .with_supports_all_types();

    let mut seed = [0_u8; 32];
    client.rng().fill_bytes(&mut seed);

    let (name_service_account, name_service_seed) = AccountBuilder::new(seed)
        .account_type(AccountType::RegularAccountUpdatableCode)
        .storage_mode(AccountStorageMode::Public)
        .with_component(name_service_component.clone())
        .with_auth_component(NoAuth)
        .build()?;

    println!(
        "counter_contract address: {}",
        Address::AccountId(AccountIdAddress::new(
            name_service_account.id(),
            AddressInterface::Unspecified
        ))
        .to_bech32(NetworkId::Testnet)
    );

    client
        .add_account(
            &name_service_account.clone(),
            Some(name_service_seed),
            false,
        )
        .await?;

    println!("\n[STEP 2] Deploy name service account");

    let tx_script_code = fs::read_to_string("../masm/scripts/deploy_name_service.masm")?;
    let tx_script = ScriptBuilder::default()
        .with_dynamically_linked_library(name_service_component.library())?
        .compile_tx_script(tx_script_code)?;

    let deploy_tx_request = TransactionRequestBuilder::new()
        .custom_script(tx_script)
        .build()?;

    let tx_result = client
        .new_transaction(name_service_account.id(), deploy_tx_request)
        .await
        .context("failed to execute creation transaction")?;

    let tx_id = tx_result.executed_transaction().id();

    // Submit transaction to the network
    client.submit_transaction(tx_result).await?;
    client.sync_state().await?;

    println!(
        "Successfully deployed name service account with ID {}",
        name_service_account.id()
    );
    println!("View transaction on MidenScan: https://testnet.midenscan.com/tx/{tx_id}");

    Ok(())
}
