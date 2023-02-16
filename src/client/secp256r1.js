/*************************************************************
 * TODAQ Open: TODA File Implementation
 * Toronto 2022
 *
 * Apache License 2.0
 *************************************************************/


const { LocalKeyPair } = require("./keypair");
const { SignatureRequirement, RequirementSatisfier } = require("../core/reqsat");
const fs = require("fs-extra");

function _isNode() {
    return ((typeof document === "undefined") && (typeof navigator === "undefined" || navigator.product !== "ReactNative"));
}

if (_isNode()) {
    const { Crypto } = eval("require('@peculiar/webcrypto');");
    crypto = new Crypto();
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

    static importRawKey(keyFormat, buffer) {
        return crypto.subtle.importKey(
            keyFormat,
            buffer,
            this.curve,
            true, // extractable
            ["sign", "verify"]
        );
    }

    static importKey(keyFormat, buffer) {
        return this.importRawKey(keyFormat, this._fromPEM(buffer.toString()));
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
        let pubKey = await this.importRawKey("spki", rawPublicKeyBuffer);
        return crypto.subtle.verify(
            this.sigParams,
            pubKey,
            signedString,
            data
        );
    }
}

RequirementSatisfier.registerSatisfier(SECP256r1.requirementTypeHash, SECP256r1);

exports.SECP256r1 = SECP256r1;
