"use strict";
// Programmatic example of creating a Squad
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = __importStar(require("@sqds/sdk"));
const web3_js_1 = require("@solana/web3.js");
const sdk_2 = require("@sqds/sdk");
const bn_js_1 = __importDefault(require("bn.js"));
const functions_1 = require("../functions");
// creates a multisig with 1 signer and a single member using the immediate function
const createSquadExample = () => __awaiter(void 0, void 0, void 0, function* () {
    const walletKeypair = web3_js_1.Keypair.generate();
    const squads = sdk_1.default.devnet(new sdk_2.Wallet(walletKeypair));
    const createKey = walletKeypair.publicKey;
    const threshold = 1;
    const members = [walletKeypair.publicKey];
    const name = 'Test Squad';
    const description = 'This is a test squad';
    try {
        // airdrop to fund the wallet - may fail occasionally since it defaults to public devnet
        const sig = yield (0, functions_1.airdrop)(squads.connection, walletKeypair.publicKey, web3_js_1.LAMPORTS_PER_SOL);
        const multisigAccount = yield squads.createMultisig(threshold, createKey, members, name, description);
        console.log("Successfully created a new multisig at", multisigAccount.publicKey.toBase58());
        console.log('Multisig account:', JSON.stringify(multisigAccount));
        const [vault] = yield (0, sdk_1.getAuthorityPDA)(multisigAccount.publicKey, new bn_js_1.default(1), sdk_1.DEFAULT_MULTISIG_PROGRAM_ID);
        console.log("Default Vault address:", vault.toBase58());
    }
    catch (e) {
        console.log('Error:', e);
    }
});
createSquadExample();
