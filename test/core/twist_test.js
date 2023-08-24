import { TwistBuilder } from "../../src/core/twist.js";
import { PairTriePacket } from "../../src/core/packet.js";
import { Sha256 } from "../../src/core/hash.js";
import { ByteArray } from "../../src/core/byte-array.js";
import assert from "assert";

describe("TwistBuilder/getBodyPacket", () => {
    it("properly merges an existing packet with additional rig entries", () => {
        let x = new TwistBuilder();
        x.setRiggingPacket(PairTriePacket.createFromUnsorted(new Map([[Sha256.fromBytes(ByteArray.fromUtf8("bbq")),
                                                        Sha256.fromBytes(ByteArray.fromUtf8("bbq"))],
                                                       [Sha256.fromBytes(ByteArray.fromUtf8("bbq2")),
                                                        Sha256.fromBytes(ByteArray.fromUtf8("bbq2"))]
                                                      ])));
        x.addRigging(Sha256.fromBytes(ByteArray.fromUtf8("sauce")),
                     Sha256.fromBytes(ByteArray.fromUtf8("sauce")));
        let body = x.getBodyPacket();
        let riggingPacket = x.atoms.get(body.getRiggingHash());
        let rigging = riggingPacket.getShapedValue();
        assert.equal(rigging.size, 3);
        assert(riggingPacket.get(Sha256.fromBytes(ByteArray.fromUtf8("sauce")))
               .equals(Sha256.fromBytes(ByteArray.fromUtf8("sauce")).toBytes()));
    });
});
