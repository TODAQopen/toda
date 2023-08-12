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


    static hexes_helper = Array.from(Array(256)).map((n,i)=>i.toString(16).padStart(2, '0'));

    toString() {
        if(this.str)
            return this.str;
        let hex = '';
        let l = this.byteLength;
        for (let i = 0; i < l; i++)
            hex += ByteArray.hexes_helper[this[i]];
        Object.defineProperty(this, 'str', { value: hex } ); // dx: this is slower than setting the string directly, but without it some deep equal tests fail... :/
        return hex;
    }

    toUTF8String() {
        return this.reduce((acc, n) => acc + String.fromCharCode(n), '')
    }

    toInt() {
        return new DataView(this.buffer, 0, 4).getUint32(0, false)
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
