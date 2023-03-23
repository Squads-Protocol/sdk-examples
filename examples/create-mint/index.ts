// Programmatic example of creating a Squad with 3 members, creating a mint, assigning the authority to the vault and minting a token

import Squads, { DEFAULT_MULTISIG_PROGRAM_ID, getAuthorityPDA } from '@sqds/sdk';
import {Keypair, LAMPORTS_PER_SOL, PublicKey} from '@solana/web3.js';
import {Wallet} from '@sqds/sdk';
import BN from 'bn.js';

import {airdrop} from "../functions";
import { createAssociatedTokenAccount, createMint, createMintToInstruction } from '@solana/spl-token';


const walletKeypair = Keypair.generate();
const squads = Squads.devnet(new Wallet(walletKeypair));

// creates a multisig with 1 signer and a single member using the immediate function
const createSquad = async (members: PublicKey[], threshold: number) => {

    const createKey = walletKeypair.publicKey;
    const name = 'Test Squad';
    const description = 'This is a test squad';
    
    try {
        const multisigAccount = await squads.createMultisig(threshold, createKey, members, name, description);
        console.log("Successfully created a new multisig at", multisigAccount.publicKey.toBase58());
        console.log('Multisig account:', JSON.stringify(multisigAccount));
        const [vault] = await getAuthorityPDA(multisigAccount.publicKey, new BN(1), DEFAULT_MULTISIG_PROGRAM_ID);
        console.log("Default Vault address:", vault.toBase58());
        return {multisigPublicKey: multisigAccount.publicKey, vaultPublicKey: vault};
    }catch(e){
        console.log('Error:', e);
        throw e;
    }
};

// for simplicity, all of the methods being used are immediate, so a new instance of the Squads SDK is instantiated for each "wallet"
const mintExample = async () => {
    // airdrop to fund the wallet - may fail occasionally since it defaults to public devnet
    await airdrop(squads.connection, walletKeypair.publicKey, LAMPORTS_PER_SOL);

    const otherMembersBesidesWallet = [
        Keypair.generate(),
        Keypair.generate(),
    ];


    const initMembers = [walletKeypair.publicKey, ...otherMembersBesidesWallet.map(kp => kp.publicKey)];
    const initThreshold = 2;
    const {multisigPublicKey, vaultPublicKey} = await createSquad(initMembers, initThreshold);
    await airdrop(squads.connection, vaultPublicKey, LAMPORTS_PER_SOL);

    // Create a mint, and assign the authority to the vault
    const newMint = await createMint(squads.connection, walletKeypair, vaultPublicKey, vaultPublicKey, 0, undefined, {commitment: 'processed', skipPreflight: true});
    console.log("New mint created at ", newMint.toBase58());

    // wallet that will get the minted token
    const recipientWallet = Keypair.generate().publicKey;
    // will need to create an ata for this wallet
    const recipientTokenAccount = await createAssociatedTokenAccount(squads.connection, walletKeypair, newMint, recipientWallet);
    console.log("Recipient token account created at ", recipientTokenAccount.toBase58());

    // Create a multisig instruction to mint a token and send it to the recipient wallet
    const mintTokenInstruction = await createMintToInstruction(newMint, recipientWallet, vaultPublicKey, 1);

    // create the multisig transaction - use default authority Vault (1)
    const multisigTransaction = await squads.createTransaction(multisigPublicKey, 1);

    // add the instruction to the transaction
    await squads.addInstruction(multisigTransaction.publicKey, mintTokenInstruction);

    // activate the transaction so all members can vote on it
    await squads.activateTransaction(multisigTransaction.publicKey);

    // vote on the transaction
    await squads.approveTransaction(multisigTransaction.publicKey);

    // still need one more approval from another member, so we'll use the other member's wallet
    const otherMemberWallet = new Wallet(otherMembersBesidesWallet[0]);
    // make sure there are lamports in the wallet
    await airdrop(squads.connection, otherMemberWallet.publicKey, LAMPORTS_PER_SOL);
    const otherMemberSquads = Squads.devnet(otherMemberWallet);
    await otherMemberSquads.approveTransaction(multisigTransaction.publicKey);

    // now you can also check the transaction state, as it should be "executeReady" as the 2/3 threshold has been met
    const transaction = await squads.getTransaction(multisigTransaction.publicKey);
    console.log('Transaction state:', transaction.status);

    // finally, we have the last member wallet execute it if we like
    const executorMemberWallet = new Wallet(otherMembersBesidesWallet[1]);
    const executorMemberSquads = Squads.devnet(executorMemberWallet);
    // make sure there are lamports in the wallet
    await airdrop(squads.connection, executorMemberWallet.publicKey, LAMPORTS_PER_SOL);

    // execute the transaction
    await executorMemberSquads.executeTransaction(multisigTransaction.publicKey);

    // now we should be able to see that the recipient wallet has a token
    const receipientTokenAccountValue = await squads.connection.getTokenAccountBalance(recipientTokenAccount);
    console.log('Recipient token account balance:', receipientTokenAccountValue.value.uiAmount);
};

mintExample();