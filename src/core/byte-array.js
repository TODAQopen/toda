/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

class ByteArray extends Uint8Array {

    // Reads binary data from a string into a buffer.
    static fromStr(str) {
        return new ByteArray(Buffer.from(str, "binary"));
    }

    concat(x) {
        let res = new ByteArray(this.length + x.length);
        res.set(this);
        res.set(x, this.length);
        return res;
    }

    toString() {
        return Buffer.from(this).toString("hex");
    }

    toUTF8String() {
        return Buffer.from(this).toString();
    }

    toInt() {
        return Buffer.from(this).readUInt32BE();
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

exports.ByteArray = ByteArray;
