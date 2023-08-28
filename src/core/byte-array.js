/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

class ByteArray extends Uint8Array {

    // Reads utf8 string data into a Uint8Array
    static fromUtf8(str) {
        return ByteArray.from(str.split("").map(x => x.charCodeAt()))
    }

    // Reads hex string data into a Uint8Array
    static fromHex(str) {
        let result = [];
        for (let i = 0; i < str.length; i += 2) {
            result.push(parseInt(str.substring(i, i + 2), 16));
        }
        return ByteArray.from(result);
    }

    static toInt(bytes, offset=0, length=0) {
        return new DataView(bytes.buffer, offset || bytes.byteOffset, length || bytes.byteLength).getUint32(0, false);
    }

    static fourByteInt(n) {
        let bytes = new Uint8Array(4);
        for (let i = 3; i >= 0; i--) {
            bytes[i] = n & (255);
            n = n >> 8;
        }
        return bytes;
    }

    static hexes_helper = Array.from(Array(256)).map((n,i)=>i.toString(16).padStart(2, '0'));


    concat(bytes) { // dx: exterminate
        let res = new ByteArray(this.length + bytes.length);
        res.set(this);
        res.set(bytes, this.length);
        return res;
    }

    /**
     * @param {int} offset starting byte
     * @param {int} length total length of bytes
     * @returns {string}
     **/
    toHex(offset=0, length=0) {
        let hex = '';
        const hh = ByteArray.hexes_helper;
        const o = offset || 0;
        const l = o + (length || this.byteLength);
        for (let i = o; i < l; i++) {
            hex += hh[this[i]];
        }
        return hex;
    }

    toUTF8String() { // dx: perf: make this fast; accept offset and length
        return this.reduce((acc, n) => acc + String.fromCharCode(n), '')
    }

    toString() { // dx: don't call this deliberately, it's only here for console output and a few low-level tests
        return this.toHex();
    }
}

export { ByteArray };
