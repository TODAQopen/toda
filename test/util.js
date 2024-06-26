import { utf8ToBytes } from "../src/core/byteUtil.js";
import { Sha256 } from "../src/core/hash.js";
import { Atoms } from "../src/core/atoms.js";
import { HashMap } from "../src/core/map.js";
import { PairTriePacket } from "../src/core/packet.js";
import { v4 as uuid } from "uuid";

// string-bytes-hash
function sbh (s) {
    return Sha256.fromBytes(utf8ToBytes(s));
}

function randH() {
    return Sha256.fromBytes(utf8ToBytes(uuid()));
}

function uuidCargo() {
    const hs = new HashMap();
    hs.set(randH(), randH());
    const packet = PairTriePacket.createFromUnsorted(hs);
    const atoms = new Atoms();
    const h = Sha256.fromPacket(packet);
    atoms.set(h, packet);
    atoms.focus = h;
    return atoms;
}

export { sbh,
         randH,
         uuidCargo };