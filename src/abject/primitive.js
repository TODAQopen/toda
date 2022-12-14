/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const {ArbitraryPacket} = require("../core/packet");
const {ByteArray} = require("../core/byte-array");
const {Abject, AbjectError, AbjectAtomMissingError} = require("./abject");
const {Hash} = require("../core/hash");

class PrimitiveError extends AbjectError {}
class PrimitiveFieldMissingError extends PrimitiveError {
    constructor(atoms, field) {
        super(atoms);
        this.missingField = field;
    }
}

class Primitive extends Abject {
    static fieldSyms = {
        value: Hash.fromHex("22882f98c8f0396585a5a040258ee7af1fa658b12b323747207a634bfee62b7095")
    };

    value() {
        return this.constructor.parsePrimitive(this.getField(Primitive.fieldSyms.value));
    }

    setPrimitiveValue(valuePacket) {
        this.setField(Primitive.fieldSyms.value, valuePacket);
    }

    static parse(atoms, focus) {

        let cargo; //slighty duplicated.. we could put pass the focusPacket
        if (focus) {
            cargo = atoms.get(focus);
        } else {
            cargo = atoms.lastPacket();
        }

        let primitiveValueHash = cargo.get(this.fieldSyms.value);
        if (!primitiveValueHash) {
            throw new PrimitiveFieldMissingError(atoms, Primitive.fieldSyms.value);
        }

        let primitiveValue = atoms.get(primitiveValueHash);
        if (!primitiveValue) {
            throw new AbjectAtomMissingError(atoms,
                primitiveValueHash,
                [Primitive.fieldSyms.value]);
        }

        return this.parsePrimitive(primitiveValue, atoms);
    }
}

/**
 * Primitive UTF8-encoded string
 */
class P1String extends Primitive {
    static interpreter = Hash.fromHex("22afcfeed9b1c0a28ed7d197f23e7d33272bdb562aa8d9ccf151b8f9767ca09032");

    /**
     * @param str <String>
     */
    constructor(str) {
        super();
        this.setPrimitiveValue(new ArbitraryPacket(new ByteArray(Buffer.from(str, "utf8"))));
    }

    /**
     * @param value <ArbitraryPacket>
     * @return <String>
     */
    static parsePrimitive(value) {
        return Buffer.from(value.getShapedValue()).toString();
    }
}

/**
 * Primitive IEEE 754-encoded number
 */
class P1Float extends Primitive {
    static interpreter = Hash.fromHex("22f2781cc0020c300c84c3b9bfbe38ceb8949f2c1ced61e29f25c90ff853eb83e4");

    /**
     * @param num <Number>
     */
    constructor(num) {
        super();
        let dv = new DataView(new ArrayBuffer(8));
        dv.setFloat64(0, num);
        this.setPrimitiveValue(new ArbitraryPacket(new ByteArray(dv.buffer)));
    }

    /**
     * @param value <ArbitraryPacket>
     * @return <Number>
     */
    static parsePrimitive(value) {
        return new DataView(value.getShapedValue().buffer).getFloat64(0);
    }
}

/**
 * Primitive IEEE 8601-encoded date
 */
class P1Date extends Primitive {
    static interpreter = this.gensym("val/date");

    /**
     * @param date <Date>
     */
    constructor(date) {
        super();
        this.setPrimitiveValue(new ArbitraryPacket(new ByteArray(Buffer.from(date.toISOString(),"utf8"))));
    }

    /**
     * @param value <ArbitraryPacket> bytes for iso8601 date
     * @return <Date>
     */
    static parsePrimitive(value) {
        return new Date(Date.parse(P1String.parsePrimitive(value)));
    }
}

/**
 * Primitive boolean value
 */
class P1Boolean extends Primitive {
    static interpreter = Hash.fromHex("2209b7efb95a393d9ee01f6446f362e5cf56d5eee55b00e6118db367e28c6a945e");

    /**
     * @param truthVal <Boolean>
     */
    constructor(truthVal) {
        super();
        this.setPrimitiveValue(new ArbitraryPacket(new ByteArray([truthVal? 1 : 0])));
    }

    /**
     * @param value <ArbitraryPacket>
     * @return <Boolean>
     */
    static parsePrimitive(value) {
        // TODO: any values other than 0x00 and 0x01 will be errors.
        return !value.getShapedValue()[0] == 0;
    }

    isFalse() {
        return !this.isTrue();
    }

    isTrue() {
        return this.value();
    }
}

Abject.registerInterpreter(P1String);
Abject.registerInterpreter(P1Float);
Abject.registerInterpreter(P1Date);
Abject.registerInterpreter(P1Boolean);

exports.Primitive = Primitive;
exports.P1String = P1String;
exports.P1Float = P1Float;
exports.P1Date = P1Date;
exports.P1Boolean = P1Boolean;

