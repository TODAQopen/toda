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

    /**
   * Returns true if byte-arrays are equal and false otherwise
   * @param {ByteArray} lhs
   * @param {ByteArray} rhs
   */
    static isEqual(lhs, rhs) {
        return lhs.toString() == rhs.toString();
    }

    static toInt(bytes) {
        return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, false)
    }

    static hexes_helper = Array.from(Array(256)).map((n,i)=>i.toString(16).padStart(2, '0'));


    concat(x) {
        let res = new ByteArray(this.length + x.length);
        res.set(this);
        res.set(x, this.length);
        return res;
    }

    toString(offset=0, length=0) {
        if (!offset && this.str) {
            return this.str;
        }
        let hex = '';
        const hh = ByteArray.hexes_helper;
        const l = length || this.byteLength;
        const o = offset || 0;
        for (let i = o; i < l; i++) {
            hex += hh[this[i]];
        }
        if (!offset) {
            this.str = hex;
        }
        return hex;
    }

    toUTF8String() {
        return this.reduce((acc, n) => acc + String.fromCharCode(n), '')
    }


    equals(x) {
        return ByteArray.isEqual(this, x);
    }
}

export { ByteArray };
