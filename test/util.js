/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
* 
* Apache License 2.0
*************************************************************/

const {ByteArray} = require("../src/core/byte-array");
const {Sha256, NullHash} = require("../src/core/hash");
const assert = require("assert");

// string-bytes-hash
function sbh (s) {
    return Sha256.fromBytes(ByteArray.fromStr(s));
}

// byte-array-from-string
function bafs (s) {
    return ByteArray.fromStr(s);
}

// asserts the two byte arrays are equal
function beq (b1, b2) {
    assert(ByteArray.isEqual(b1, b2));
}

exports.sbh = sbh;
exports.bafs = bafs;
exports.beq = beq;
