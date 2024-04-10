/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const hexes_helper = Array.from(Array(256)).
    map((n,i)=>i.toString(16).padStart(2, '0'));

function byteConcat(b0, b1) { // dx: exterminate
    let res = new Uint8Array(b0.length + b1.length);
    res.set(b0);
    res.set(b1, b0.length);
    return res;
}

function hexToBytes(str) {
    let result = [];
    for (let i = 0; i < str.length; i += 2) {
        result.push(parseInt(str.substring(i, i + 2), 16));
    }
    return new Uint8Array(result);
}

/**
 * @param {int} offset starting byte
 * @param {int} length total length of bytes
 * @returns {string}
 **/
function bytesToHex(bytes, offset=0, length=0) {
    let hex = '';
    const hh = hexes_helper;
    const o = offset || 0;
    const l = o + (length || bytes.byteLength);
    for (let i = o; i < l; i++) {
        hex += hh[bytes[i]];
    }
    return hex;
}

// Reads utf8 string data into a Uint8Array
function utf8ToBytes(str) {
    return new TextEncoder("utf-8").encode(str);
}

// dx: perf: make this fast; accept offset and length
function bytesToUtf8(bytes) {
    return new TextDecoder("utf-8").decode(bytes);
}

function bytesToInt(bytes, offset=0, length=0) {
    return new DataView(bytes.buffer, offset ||
                        bytes.byteOffset, length ||
                        bytes.byteLength).getUint32(0, false);
}

function fourByteInt(n) {
    let bytes = new Uint8Array(4);
    for (let i = 3; i >= 0; i--) {
        bytes[i] = n & (255);
        n = n >> 8;
    }
    return bytes;
}

export { byteConcat,
         hexToBytes,
         bytesToHex,
         utf8ToBytes,
         bytesToUtf8,
         bytesToInt,
         fourByteInt };
