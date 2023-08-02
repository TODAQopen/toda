import { ByteArray } from "../src/core/byte-array.js";
import { Sha256 } from "../src/core/hash.js";
import assert from "assert";
import { Atoms } from "../src/core/atoms.js";
import { HashMap } from "../src/core/map.js";
import { PairTriePacket } from "../src/core/packet.js";
import { v4 as uuid } from "uuid";

// string-bytes-hash
function sbh (s) {
    return Sha256.fromBytes(ByteArray.fromUtf8(s));
}

// byte-array-from-string
function bafs (s) {
    return ByteArray.fromUtf8(s);
}

// asserts the two byte arrays are equal
function beq (b1, b2) {
    assert(ByteArray.isEqual(b1, b2));
}

function randH()
{
    return Sha256.fromBytes(ByteArray.fromUtf8(uuid()));
}

function uuidCargo()
{
    const hs = new HashMap();
    hs.set(randH(), randH());
    const packet = PairTriePacket.createFromUnsorted(hs);
    const atoms = new Atoms();
    atoms.set(Sha256.fromPacket(packet), packet);
    return atoms;
}

export { sbh, 
         bafs,
         beq,
         randH,
         uuidCargo };