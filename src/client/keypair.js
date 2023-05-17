import { RequirementSatisfier, SignatureSatisfaction } from '../core/reqsat.js';
import { ByteArray } from '../core/byte-array.js';
import { Crypto } from '@peculiar/webcrypto'
const crypto = new Crypto();

import fs from 'fs-extra';

class KeyPair extends RequirementSatisfier {

    static generate() {
        throw new Error('not implemented');
    }

    signBytes(bytes) {
        throw new Error('not implemented');
    }

    static verifySig(rawPublicKeyBuffer, derSignatureBuffer, data) {
        throw new Error('not implemented');
    }

    static verifySatisfaction(reqTypeHash, twist, reqPacket, satPacket) {
        // we generally verify sig over the body hash:
        let bodyHash = twist.packet.getBodyHash();
        return this.verifySig(reqPacket.getShapedValue(),
                              satPacket.getShapedValue(),
                              bodyHash.serialize());
    }

    async isSatisfiable(requirementTypeHash, requirementPacket) {
        if (!requirementTypeHash.equals(this.constructor.requirementTypeHash)) {
            return false;
        }
        return requirementPacket.getShapedValue().equals(await this.exportPublicKey());
    }

    async satisfy(prevTwist, newBodyHash) {
        return new SignatureSatisfaction(prevTwist.getHashImp(),
                                         this.constructor.requirementTypeHash,
                                         await this.signBytes(newBodyHash.serialize()));
    }
}

class LocalKeyPair extends KeyPair {

    async exportRawPublicKey() {
        return crypto.subtle.exportKey(
            "spki",
            this.publicKey
        );
    }

    async exportPublicKey() {
        return new ByteArray(await this.exportRawPublicKey());
    }

    async toDisk(privateKeyPath, publicKeyPath) {
        let publicKey = await crypto.subtle.exportKey(
            "spki",
            this.publicKey
        );
        let privateKey = await crypto.subtle.exportKey(
            "pkcs8",
            this.privateKey
        );
        fs.outputFileSync(publicKeyPath,
                          this.constructor._toPEM(Buffer.from(publicKey), "PUBLIC KEY"), {mode: 0o600});

        fs.outputFileSync(privateKeyPath,
                          this.constructor._toPEM(Buffer.from(privateKey), "PRIVATE KEY"), {mode: 0o600});
    }

    static async fromDisk(privateKeyPath, publicKeyPath) {
        publicKeyPath = publicKeyPath || privateKeyPath + ".pub";

        return new this(await this.importKey("pkcs8",fs.readFileSync(privateKeyPath)),
                        await this.importKey("spki",fs.readFileSync(publicKeyPath)));
    }

    /** Converts a Buffer representing a key into a PEM string
     * Modified with love from https://www.npmjs.com/package/pemtools
     * @param buffer <Buffer> A buffer representing the key
     * @param header <String> the desired header for the key
     * @returns {String} the pem string
     */
    static _toPEM(buffer, header) {
        return `-----BEGIN ${header}-----\n` +
            buffer.toString("base64")
            .match(/.{1,64}/g)
            .join("\n") +
            `\n-----END ${header}-----`;
    }

    /** Converts a pem string to a Buffer
     * Ignores any characters before the header boundary and removes all whitespace between the header and footer boundaries
     * Modified with love from https://www.npmjs.com/package/pemtools
     * @param pem <String> The PEM string representing a key
     * @returns {Buffer} the key
     */
    static _fromPEM(pem) {
        let headerRegex = /\-\-\-\-\-\s*BEGIN ?([^-]+)?\-\-\-\-\-/;
        let footerRegex = /\-\-\-\-\-\s*END ?([^-]+)?\-\-\-\-\-/;

        let headerMatch = headerRegex.exec(pem);
        let footerMatch = footerRegex.exec(pem);

        if (!headerMatch) {
            throw new Error("parse PEM: BEGIN not found");
        }

        let keyString = pem.slice(headerMatch.index + headerMatch[0].length, footerMatch.index).replace(/\s/g, "");
        return ByteArray.fromUtf8(this.base64ToUtf8(keyString));
    }

    static base64ToUtf8(str) {
        if(atob instanceof Function)
            return atob(str)
        return Buffer.from(keyString, "base64").toString()
    }

    static _derConstructLength(arr, len) {
        return arr.concat(new ByteArray([len]));
    }

    static _toDER(signedString) {
        // This function adds the DER headers into the signed string for
        // compatibility with pretty much every other crypto library out
        // there.

        let signature = new ByteArray(signedString);

        // get r and s
        let r = signature.slice(0, 32);
        let s = signature.slice(32, 64);

        // Pad values
        if (r[0] & 0x80) {
            r = new ByteArray([ 0 ]).concat(r);
        }
        // Pad values
        if (s[0] & 0x80) {
            s = new ByteArray([ 0 ]).concat(s);
        }

        // Remove the padded zeros at the beginning of r and s
        r = this._derRemovePadding(r);
        s = this._derRemovePadding(s);

        // I don't think this should be needed -> its covered by rmPadding(s)
        // but was in elliptic library.  Is there a case I'm missing by removing this?
        while (!s[0] && !(s[1] & 0x80)) {
            s = s.slice(1);
        }

        // Create the array.  Start with r
        let arr = new ByteArray([ 0x02 ]);
        arr = this._derConstructLength(arr, r.length);
        arr = arr.concat(r);

        // Now add on s
        arr = arr.concat(new ByteArray([0x02]));
        arr = this._derConstructLength(arr, s.length);
        arr = arr.concat(s);

        // Create the final signed array. It starts with 0x30 and then the full length of the new (r + s)
        let res = new ByteArray([ 0x30 ]);
        res = this._derConstructLength(res, arr.length);

        // After that concat on the new r and s
        res = res.concat(arr);

        // And return the ByteArray
        return res;
    }

    static _fromDER(sig) {
        // This function strips the DER headers out of signatures from,
        // well, pretty much anywhere

        var bytes = new ArrayBuffer(64);
        var view = new ByteArray(bytes);

        // Strip(/check?) the DER header for the whole signature
        // sig[0] should yield 0x30 and there should probably be an exception thrown if it isn't
        // sig[1] should yield sig.length-2 (because the type and length bytes aren't counted)
        var offset = 2;

        // extract r (and its header)
        // sig[2] shoule be 0x02 and there should probably be an exception thrown if it isn't
        var length = sig[offset + 1]; // should be =< 32
        offset += 2;

        if (sig[offset] == 0) {
            offset++;
            length--;
        }

        for (var i = 0; i < 32-length; i++)
            view[i] = 0;

        for (i = 0; i < length; i++)
            view[32 - length + i] = sig[offset + i];

        offset += length;

        // extract s (and its header)
        // sig[offset] shoule be 0x02 and there should probably be an exception thrown if it isn't
        length = sig[offset + 1]; // should be =< 32
        offset += 2;

        if (sig[offset] == 0) {
            offset++;
            length--;
        }

        for (var i = 32; i < 32-length; i++)
            view[i] = 0;

        for (i = 0; i < length; i++)
            view[64 - length + i] = sig[offset + i];

        return bytes;
    }

    static _derRemovePadding(buf) {
        var i = 0;
        var len = buf.length - 1;
        while (!buf[i] && !(buf[i + 1] & 0x80) && i < len) {
            i++;
        }
        if (i === 0) {
            return buf;
        }
        return buf.slice(i);
    }

}


//TODO(acg): @sfertman pls dig into this
class KMSKeyPair extends RequirementSatisfier {
    constructor(kmsId, accessToken) {
        // ...
    }
}

export { LocalKeyPair };
