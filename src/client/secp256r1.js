/*************************************************************
 * TODAQ Open: TODA File Implementation
 * Toronto 2022
 *
 * Apache License 2.0
 *************************************************************/


import { LocalKeyPair } from './keypair.js';
import { SignatureRequirement, RequirementSatisfier } from '../core/reqsat.js';
import { bytesToUtf8 } from '../core/byteUtil.js';

if(typeof window === 'undefined') {
    const { Crypto } = await import('@peculiar/webcrypto');
    globalThis.crypto = new Crypto();
}

class SECP256r1 extends LocalKeyPair {
    static requirementTypeHash = SignatureRequirement.REQ_SECP256r1;

    static curve = {
        name: "ECDSA",
        namedCurve: "P-256"
    };
    static sigParams = {
        name: "ECDSA",
        hash: { name: "SHA-256" }
    };

    /**
      * @param privateKey <CryptoKey>
      * @param publicKey <CryptoKey>
      */
    constructor(privateKey, publicKey) {
        super();
        this.privateKey = privateKey;
        this.publicKey = publicKey;
    }

    static importRawPubKey(keyFormat, buffer) {
        // NB: webcrypto will subtly throw if you import a pubkey with "sign" usage
        return crypto.subtle.importKey(
            keyFormat,
            buffer,
            this.curve,
            true, // extractable
            ["verify"]
        );
    }

    static importKey(keyFormat, buffer) {
        let b = this._fromPEM(bytesToUtf8(buffer));
        return crypto.subtle.importKey(
            keyFormat,
            b,
            this.curve,
            true, // extractable
            ["sign", "verify"]
        );
    }

    static async generate() {
        let keyPair = await crypto.subtle.generateKey(
            this.curve,
            true, // extractable
            ["sign", "verify"] //can be any combination of "sign" and "verify"
        );
        return new SECP256r1(keyPair.privateKey, keyPair.publicKey);
    }

    async signBytes(bytes) {
        let signedString = await crypto.subtle.sign(
            SECP256r1.sigParams,
            this.privateKey,
            bytes
        );

        return LocalKeyPair._toDER(signedString);
    }

    static async verifySig(rawPublicKeyBuffer, derSignatureBuffer, data) {
        let signedString = this._fromDER(derSignatureBuffer);
        let pubKey = await this.importRawPubKey("spki", rawPublicKeyBuffer);
        return crypto.subtle.verify(
            this.sigParams,
            pubKey,
            signedString,
            data
        );
    }
}

RequirementSatisfier.registerSatisfier(
    SECP256r1.requirementTypeHash, SECP256r1);

export { SECP256r1 };
