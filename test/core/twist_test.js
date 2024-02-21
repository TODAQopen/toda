import { TwistBuilder } from "../../src/core/twist.js";
import { PairTriePacket } from "../../src/core/packet.js";
import { Sha256 } from "../../src/core/hash.js";
import { utf8ToBytes } from "../../src/core/byteUtil.js";
import assert from 'assert';

describe("TwistBuilder/getBodyPacket", () => {
    it("properly merges an existing packet with additional rig entries", () => {
        let x = new TwistBuilder();
        x.setRiggingPacket(PairTriePacket.createFromUnsorted(new Map([[Sha256.fromBytes(utf8ToBytes("bbq")),
                                                        Sha256.fromBytes(utf8ToBytes("bbq"))],
                                                       [Sha256.fromBytes(utf8ToBytes("bbq2")),
                                                        Sha256.fromBytes(utf8ToBytes("bbq2"))]
                                                      ])));
        x.addRigging(Sha256.fromBytes(utf8ToBytes("sauce")),
                     Sha256.fromBytes(utf8ToBytes("sauce")));
        let body = x.getBodyPacket();
        let riggingPacket = x.atoms.get(body.getRiggingHash());
        let rigging = riggingPacket.getShapedValue();
        assert.equal(rigging.size, 3);
        assert(riggingPacket.get(Sha256.fromBytes(utf8ToBytes("sauce")))
               .equals(Sha256.fromBytes(utf8ToBytes("sauce"))));
    });
});