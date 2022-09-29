/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

function fourByteInt(x){
    let bytes = new Uint8Array(4);
    for (let i = 3; i >= 0; i--){
        bytes[i] = x & (255);
        x = x >> 8;
    }
    return bytes;
}

function noop() {}

function identity(x) {
    return x;
}

function isNode() {
    return ((typeof document === "undefined") && (typeof navigator === "undefined" || navigator.product !== "ReactNative"));
}

exports.fourByteInt = fourByteInt;
exports.noop = noop;
exports.identity = identity;
exports.isNode = isNode;
