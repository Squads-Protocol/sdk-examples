// Programmatic example of creating a Squad

import Squads, { DEFAULT_MULTISIG_PROGRAM_ID, getAuthorityPDA } from '@sqds/sdk';
import {Keypair, LAMPORTS_PER_SOL} from '@solana/web3.js';
import {Wallet} from '@sqds/sdk';
import BN from 'bn.js';

import {airdrop} from "../functions";


// creates a multisig with 1 signer and a single member using the immediate function
const createSquadExample = async () => {
    const walletKeypair = Keypair.generate();
        
    const squads = Squads.devnet(new Wallet(walletKeypair));
    // random key so no collision
    const createKey = new Keypair().publicKey;
    const threshold = 1;
    const members = [walletKeypair.publicKey];
    const name = 'Test Squad';
    const description = 'This is a test squad';
    
    try {
        // airdrop to fund the wallet - may fail occasionally since it defaults to public devnet
        const sig = await airdrop(squads.connection, walletKeypair.publicKey, LAMPORTS_PER_SOL);

        const multisigAccount = await squads.createMultisig(threshold, createKey, members, name, description);
        console.log("Successfully created a new multisig at", multisigAccount.publicKey.toBase58());
        console.log('Multisig account:', JSON.stringify(multisigAccount));
        const [vault] = await getAuthorityPDA(multisigAccount.publicKey, new BN(1), DEFAULT_MULTISIG_PROGRAM_ID);
        console.log("Default Vault address:", vault.toBase58());
    }catch(e){
        console.log('Error:', e);
    }
};

createSquadExample();