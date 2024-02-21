/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import { utf8ToBytes, bytesToUtf8 } from '../core/byteUtil.js';
import { ArbitraryPacket } from '../core/packet.js';

import { Abject, AbjectError, AbjectAtomMissingError } from './abject.js';
import { Hash } from '../core/hash.js';

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
        return this.constructor.parsePrimitive(
            this.getField(Primitive.fieldSyms.value));
    }

    setPrimitiveValue(valuePacket) {
        this.setField(Primitive.fieldSyms.value, valuePacket);
    }

    static parse(atoms, focus) {

        let cargo; //slighty duplicated.. we could put pass the focusPacket
        if (focus) {
            cargo = atoms.get(focus);
        } else {
            // cargo = atoms.lastPacket();
            cargo = atoms.get(atoms.focus);
        }

        let primitiveValueHash = cargo.get(this.fieldSyms.value);
        if (!primitiveValueHash) {
            throw new PrimitiveFieldMissingError(atoms, 
                Primitive.fieldSyms.value);
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
        this.setPrimitiveValue(new ArbitraryPacket(utf8ToBytes(str)));
    }

    /**
     * @param value <ArbitraryPacket>
     * @return <String>
     */
    static parsePrimitive(value) {
        return bytesToUtf8(value.getShapedValue());
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
        this.setPrimitiveValue(new ArbitraryPacket(new Uint8Array(dv.buffer)));
        // TODO: ensure this is not NaN or Infinity or -Infinity
    }

    /**
     * @param value <ArbitraryPacket>
     * @return <Number>
     */
    static parsePrimitive(value) {
        // TODO: ensure this is not NaN or Infinity or -Infinity
        const sv = value.getShapedValue();
        return new DataView(sv.buffer.slice(sv.byteOffset, sv.byteLength + sv.byteOffset)).getFloat64(0);
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
        this.setPrimitiveValue(new ArbitraryPacket(
            utf8ToBytes(date.toISOString())));
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
        this.setPrimitiveValue(new ArbitraryPacket(
            new Uint8Array([truthVal? 1 : 0])));
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

export { Primitive };
export { P1String };
export { P1Float };
export { P1Date };
export { P1Boolean };