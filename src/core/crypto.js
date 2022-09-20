/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
* 
* Apache License 2.0
*************************************************************/

const {ByteArray} = require("./byte-array");

function _isNode() {
    return ((typeof document === "undefined") && (typeof navigator === "undefined" || navigator.product !== "ReactNative"));
}

if (_isNode()) {
    const { Crypto } = eval("require('@peculiar/webcrypto');");
    crypto = new Crypto();
}


class TodaKeys {

}

class Secp256r1 extends TodaKeys {

    // TODO: generate()
    // TODO: sign()

    static async verify(pubKeyBytes, signatureBytes, data) {

        // the signatures are passed around all DER encoded, but crypto.subtle doesn't work with that
        let signature = _fromDER(signatureBytes);

        // piss me off async:
        let publicKey = await crypto.subtle.importKey(
            "spki",
            pubKeyBytes,
            {name: "ECDSA", namedCurve: "P-256",},
            true,
            ["sign", "verify"]);
        return crypto.subtle.verify({name: "ECDSA", hash: {name: "SHA-256"}},
            publicKey,
            signature,
            data);

    }
}

function _fromDER(sig) {
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

    for (var i = 0; i < 32 - length; i++)
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

    for (var i = 32; i < 32 - length; i++)
        view[i] = 0;

    for (i = 0; i < length; i++)
        view[64 - length + i] = sig[offset + i];

    return bytes;
}

exports.Secp256r1 = Secp256r1;
