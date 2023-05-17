import { ByteArray } from "../src/core/byte-array.js";
import { Sha256 } from "../src/core/hash.js";
import assert from "assert";

// string-bytes-hash
function sbh (s) {
    return Sha256.fromBytes(ByteArray.fromUtf8(s));
}

// byte-array-from-string
function bafs (s) {
    return ByteArray.fromUtf8(s);
}

// asserts the two byte arrays are equal
function beq (b1, b2) {
    assert(ByteArray.isEqual(b1, b2));
}

export { sbh };
export { bafs };
export { beq };
