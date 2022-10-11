/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const { ByteArray } = require("../../core/byte-array");
const os = require("os");
const fs = require("fs-extra");

function _isNode() {
    return ((typeof document === "undefined") && (typeof navigator === "undefined" || navigator.product !== "ReactNative"));
}

if (_isNode()) {
    const { Crypto } = eval("require('@peculiar/webcrypto');");
    crypto = new Crypto();
}

// XXX(acg): How these keys are generated, and where they are stored
// is highly platform-specific.  Ideally they are not generated in an
// "extractable" form.

async function generateKey() {
    let keyPair = await crypto.subtle.generateKey(
        {
            name: "ECDSA",
            namedCurve: "P-256", //can be "P-256", "P-384", or "P-521"
        },
        true, //whether the key is extractable (i.e. can be used in exportKey)
        ["sign", "verify"] //can be any combination of "sign" and "verify"
    );
    if (keyPair) {
        let publicKey = await crypto.subtle.exportKey(
            "spki", //can be "jwk" (public or private), "spki" (public only), or "pkcs8" (private only)
            keyPair.publicKey //can be a publicKey or privateKey, as long as extractable was true
        );

        return {privateKey: keyPair.privateKey, publicKey: publicKey};
    }  else {
        throw new Error("Error creating key pair");
    }
}

const KeyConfig = {
    publicKey: {
        path: `${os.homedir()}/.toda/secure/id_secp256r1.pub`,
        header: "PUBLIC KEY",
        format: "spki"
    },
    privateKey: {
        path: `${os.homedir()}/.toda/secure/id_secp256r1`,
        header: "PRIVATE KEY",
        format: "pkcs8"
    }
};

/** Imports a public key file and parses it
 * @param outPublic <String> the path to the public key file
 * @param outPrivate <String> the path to the private key file
 * @returns {Promise<Object>} the generated keypair
 */
async function createKeys(outPublic, outPrivate) {
    let keyPair = await generateKey();
    let publicPem = _toPEM(Buffer.from(keyPair.publicKey), KeyConfig.publicKey.header);
    fs.outputFileSync(outPublic || KeyConfig.publicKey.path, publicPem.toString(), {mode: 0o600});

    let privateKey = await crypto.subtle.exportKey(KeyConfig.privateKey.format, keyPair.privateKey);
    let privatePem = _toPEM(Buffer.from(privateKey), KeyConfig.privateKey.header);
    fs.outputFileSync(outPrivate || KeyConfig.privateKey.path, privatePem.toString(), {mode: 0o600});

    return keyPair;
}

/** Converts a Buffer representing a key into a PEM string
 * Modified with love from https://www.npmjs.com/package/pemtools
 * @param buffer <Buffer> A buffer representing the key
 * @param header <String> the desired header for the key
 * @returns {String} the pem string
 */
function _toPEM(buffer, header) {
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
function _fromPEM(pem) {
    let headerRegex = /\-\-\-\-\-\s*BEGIN ?([^-]+)?\-\-\-\-\-/;
    let footerRegex = /\-\-\-\-\-\s*END ?([^-]+)?\-\-\-\-\-/;

    let headerMatch = headerRegex.exec(pem);
    let footerMatch = footerRegex.exec(pem);

    if (!headerMatch) {
        throw new Error("parse PEM: BEGIN not found");
    }

    let keyString = pem.slice(headerMatch.index + headerMatch[0].length, footerMatch.index).replace(/\s/g, "");
    return Buffer.from(keyString, "base64");
}

/** Imports a public key file and parses it
 * @param path <String> the path to the key file
 * @returns {Promise<void|CryptoKey>} The imported key
 */
async function importPublicKey(path) {
    return importKey(path || KeyConfig.publicKey.path, KeyConfig.publicKey.format, KeyConfig.publicKey.header, ["verify"]);
}

/** Imports a public key file and parses it
 * @param path <String> the path to the key file
 * @returns {Promise<void|CryptoKey>} The imported key
 */
//todo(mje): We'll need to add support for ENCRYPTED private key
async function importPrivateKey(path) {
    return importKey(path || KeyConfig.privateKey.path, KeyConfig.privateKey.format, KeyConfig.privateKey.header, ["sign"]);
}

async function readKey(path) {
    return fs.readFile(path).then(pem => _fromPEM(pem.toString()));
}

/** Imports a key file and parses it
 * @param path <String> the path to the key file
 * @param format <String> the format of the key
 * @param header <String> the key header eg. PUBLIC KEY
 * @param keyUsages <Array<String>> what the key is used for
 * @returns {Promise<void|CryptoKey>} The imported key
 */
async function importKey(path, format, header, keyUsages) {
    let pem = fs.readFileSync(path).toString();
    let keyData = _fromPEM(pem);
    return crypto.subtle.importKey(
        format,
        keyData,
        {
            name: "ECDSA",
            namedCurve: "P-256",
        },
        true,
        keyUsages
    );
}

async function signBytes(privateKey, data) {
    let signedString = await crypto.subtle.sign(
        {
            name: "ECDSA",
            hash: { name: "SHA-256" }, //can be "SHA-1", "SHA-256", "SHA-384", or "SHA-512"
        },
        privateKey,
        data
    );

    return _toDER(signedString);
}

async function verifySig(publicKey, signature, data) {
    // the signatures are passed around all DER encoded, but crypto.subtle doesn't work with that
    let signedString = _fromDER(signature);

    // and the pubkeys are passed around exported to spki, which also needs conversion
    let pubKey = await crypto.subtle.importKey(
        "spki", // the format exported to when we generate keys
        publicKey,
        {
            name: "ECDSA",
            namedCurve: "P-256",
        },
        true,
        ["verify"],
    );

    var ok = await crypto.subtle.verify(
        {
            name: "ECDSA",
            hash: { name: "SHA-256" }, //can be "SHA-1", "SHA-256", "SHA-384", or "SHA-512"
        },
        pubKey,
        signedString,
        data
    );

    return ok;
}

exports.generateKey = generateKey;
exports.createKeys = createKeys;
exports._toPEM = _toPEM;
exports._fromPEM = _fromPEM;
exports.importPrivateKey = importPrivateKey;
exports.importPublicKey = importPublicKey;
exports.signBytes = signBytes;
exports.verifySig = verifySig;
exports.readKey = readKey;

function _derConstructLength(arr, len) {
    return arr.concat(new ByteArray([len]));
}

function _toDER(signedString) {
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
    r = _derRemovePadding(r);
    s = _derRemovePadding(s);

    // I don't think this should be needed -> its covered by rmPadding(s)
    // but was in elliptic library.  Is there a case I'm missing by removing this?
    while (!s[0] && !(s[1] & 0x80)) {
        s = s.slice(1);
    }

    // Create the array.  Start with r
    let arr = new ByteArray([ 0x02 ]);
    arr = _derConstructLength(arr, r.length);
    arr = arr.concat(r);

    // Now add on s
    arr = arr.concat(new ByteArray([0x02]));
    arr = _derConstructLength(arr, s.length);
    arr = arr.concat(s);

    // Create the final signed array. It starts with 0x30 and then the full length of the new (r + s)
    let res = new ByteArray([ 0x30 ]);
    res = _derConstructLength(res, arr.length);

    // After that concat on the new r and s
    res = res.concat(arr);

    // And return the ByteArray
    return res;
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

function _derRemovePadding(buf) {
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

// additional exports for deeper unit testing (there should be some better way to expose these functions to the test file)
exports._toDER = _toDER;
exports._fromDER = _fromDER;
exports._derRemovePadding = _derRemovePadding;
exports._derConstructLength = _derConstructLength;
