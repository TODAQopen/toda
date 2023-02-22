/*************************************************************
 * TODAQ Open: TODA File Implementation
 * Toronto 2023
 *
 * Apache License 2.0
 *************************************************************/

const {TwistBuilder} = require("../../src/core/twist");
const {PairTriePacket} = require("../../src/core/packet");
const {Sha256} = require("../../src/core/hash");
const {ByteArray} = require("../../src/core/byte-array");

const assert = require("assert");

describe("TwistBuilder/getBodyPacket", () => {
    it("properly merges an existing packet with additional rig entries", () => {
        let x = new TwistBuilder();
        x.setRiggingPacket(PairTriePacket.createFromUnsorted(new Map([[Sha256.fromBytes(ByteArray.fromStr("bbq")),
                                                        Sha256.fromBytes(ByteArray.fromStr("bbq"))],
                                                       [Sha256.fromBytes(ByteArray.fromStr("bbq2")),
                                                        Sha256.fromBytes(ByteArray.fromStr("bbq2"))]
                                                      ])));
        x.addRigging(Sha256.fromBytes(ByteArray.fromStr("sauce")),
                     Sha256.fromBytes(ByteArray.fromStr("sauce")));
        let body = x.getBodyPacket();
        let riggingPacket = x.atoms.get(body.getRiggingHash());
        let rigging = riggingPacket.getShapedValue();
        assert.equal(rigging.size, 3);
        assert(riggingPacket.get(Sha256.fromBytes(ByteArray.fromStr("sauce")))
               .equals(Sha256.fromBytes(ByteArray.fromStr("sauce")).serialize()));
    });
});
