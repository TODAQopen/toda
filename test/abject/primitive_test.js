import { P1String, P1Float, P1Date, P1Boolean } from "../../src/abject/primitive.js";
import { Abject } from "../../src/abject/abject.js";
import { Sha256 } from "../../src/core/hash.js";
import assert from 'node:assert/strict';

// TODO(acg): A lot of edge-testing with various AbjectErrors, etc.

describe("P1String", () => {
    it("can be created", () => {
        let p1s = new P1String("introduction to the calculus of variations");
        let atoms = p1s.serialize(Sha256);
        assert.equal(atoms.toPairs().length, 2);

        // we expect two atoms.  One containing the raw utf8 string
        // above, and one containing a trie with [x] entries: the
        // interpreter, and a reference to the string packet.

        // XX(acg): these are more testing Abject internals:
        let keys = [...atoms.keys()];
        let triePacket = atoms.get(keys[1]).getShapedValue();
        // TODO: massage this test: the triePacket Map keys aren't object-pointer equal any more, but they are serialized equal...
        // assert.equal(triePacket.get(Abject.NULL), P1String.interpreter);
        // assert.equal(triePacket.get(Primitive.fieldSyms.value), keys[0]);
        assert.equal(triePacket.size, 2);

        assert.equal(Buffer.from(atoms.get(keys[0]).getShapedValue()).toString(),
            "introduction to the calculus of variations");
    });

    it("can be read", () => {
        let p1s = new P1String("introduction to the calculus of variations");
        let atoms = p1s.serialize(Sha256);
        assert.equal(Abject.parse(atoms), "introduction to the calculus of variations");

    });

    it("handles unicode", () => {
        const str = "🈚️🍶♉️⛈🌐😢💋🔙🏯♨️☁️🤘📖🍮➕😌🏚🕯🔌🙃"
        let p1s = new P1String(str);
        let atoms = p1s.serialize(Sha256);
        assert.equal(Abject.parse(atoms), str);
    });

    it("confirms ascii strings from old charCodeAt method are compatible with TextDecoder", ()=> {
        const str = "Hello, I am a basic ascii string with all code points smaller than 127"

        // encode string using old encoder
        const enc = new Uint8Array(str.split("").map(x => x.charCodeAt()));

        // decode using current decoder
        const dec = new TextDecoder("utf-8").decode(enc);

        assert.equal(str, dec);
    });
});

describe("P1Float", () => {

    it("integers work", () => {
        let p1n = new P1Float(42);
        let atoms = p1n.serialize(Sha256);
        assert.equal(atoms.toPairs().length, 2);

        // we expect two atoms.  One containing the raw ieee num
        // above, and one containing a trie with [x] entries: the
        // interpreter, and a reference to the num packet

        // XX(acg): these are more testing Abject internals:
        let keys = [...atoms.keys()];
        let triePacket = atoms.get(keys[1]).getShapedValue();
        // TODO: massage this test: the triePacket Map keys aren't object-pointer equal any more, but they are serialized equal...
        // assert.equal(triePacket.get(Abject.NULL), P1Float.interpreter);
        // assert.equal(triePacket.get(Primitive.fieldSyms.value), keys[0]);
        assert.equal(triePacket.size, 2);

        assert.equal(Abject.parse(atoms), 42);

        atoms = new P1Float(-42).serialize(Sha256);
        assert.equal(Abject.parse(atoms), -42);

    });

    it("handles floats", () => {
        let atoms = new P1Float(3.14159/3).serialize(Sha256);
        assert.equal(Abject.parse(atoms), 3.14159/3);

        atoms = new P1Float(6.023e-23).serialize(Sha256);
        assert.equal(Abject.parse(atoms), 6.023e-23);
    });

});

describe("P1Date", () => {

    it("dates work", () => {
        let now = new Date();
        let p1d = new P1Date(now);
        let atoms = p1d.serialize(Sha256);
        assert.equal(atoms.toPairs().length, 2);

        assert.equal(Abject.parse(atoms).getTime(), now.getTime());
    });

});

describe("P1Boolean", () => {

    it("bools work", () => {
        let atoms = new P1Boolean(true).serialize(Sha256);
        assert.equal(atoms.toPairs().length, 2);
        assert.equal(Abject.parse(atoms), true);

        atoms = new P1Boolean(false).serialize(Sha256);
        assert.equal(atoms.toPairs().length, 2);
        assert.equal(Abject.parse(atoms), false);
    });

});
