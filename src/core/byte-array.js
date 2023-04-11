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
        for(let i = 0; i < str.length; i += 2)
            result.push(parseInt(str.substring(i, i + 2), 16));
        return ByteArray.from(result);
    }


    concat(x) {
        let res = new ByteArray(this.length + x.length);
        res.set(this);
        res.set(x, this.length);
        return res;
    }

    toString() {
        // dx: TODO: use the faster version
        return this.reduce((acc, n) => acc + (n < 16 ? '0' : '') + n.toString(16), '')
    }

    toUTF8String() {
        return this.reduce((acc, n) => acc + String.fromCharCode(n), '')
    }

    toInt() {
        return new DataView(this.buffer).getUint32(0, false)
    }

    equals(x) {
        return ByteArray.isEqual(this, x);
    }

    /**
   * Returns true if byte-arrays are equal and false otherwise
   * @param {ByteArray} lhs
   * @param {ByteArray} rhs
   */
    static isEqual(lhs, rhs) {
        return lhs.toString() == rhs.toString();
    }

}

export { ByteArray };
