import { DQ } from "../../src/abject/quantity.js";
import { Sha256 } from "../../src/core/hash.js";
import { TwistBuilder } from "../../src/core/twist.js";
import { ByteArray } from "../../src/core/byte-array.js";
import { Shield } from "../../src/core/shield.js";
import { ArbitraryPacket } from "../../src/core/packet.js";
import assert from 'node:assert/strict'

function sbh (x) {
    return Sha256.fromBytes(ByteArray.fromUtf8(x));
}

describe("Delegate value", () => {

    it("can do trivial delegation", async () => {
        let top = new TwistBuilder();
        top.setFieldHash(sbh("blah"), sbh("fiiiirst"));

        let shield = new ArbitraryPacket(ByteArray.fromUtf8("shield"));

        let master = DQ.mint(42);

        master.setPopTop(top.getHash());
        master.twistBuilder.tetherHash = top.getHash();
        master.twistBuilder.setShield(shield);

        let del = master.delegateValue(22);
        del.twistBuilder.tetherHash = top.getHash();
        del.twistBuilder.setShield(shield);

        let masterNext = master.createSuccessor();
        masterNext.twistBuilder.tetherHash = top.getHash();
        masterNext.confirmDelegate(del);

        let delNext = del.createSuccessor();
        delNext.twistBuilder.tetherHash = top.getHash();
        delNext.completeDelegate(masterNext);


        let topNext = top.createSuccessor();
        // could... be.. nicer..
        topNext.rigging = new Map([...Shield.rigForHoist(master.getHash(), masterNext.getHash(), shield).shapedVal,
            ...Shield.rigForHoist(del.getHash(), delNext.getHash(), shield).shapedVal]);
        delNext.addAtoms(topNext.serialize());

        await delNext.checkAllRigs();
        assert.equal(delNext.value(), 22);
        assert.equal(masterNext.value(), 20);

    });

    it("can't delegate amounts that have more precision than the bill", async () => {
        let top = new TwistBuilder();
        top.setFieldHash(sbh("blah"), sbh("fiiiirst"));

        let master = DQ.mint(42, 10);

        master.setPopTop(top.getHash());

        assert.throws(() => master.delegateValue(4.11));
    });

    it("can't delegate amounts that are greater than the bill", async () => {
        let top = new TwistBuilder();
        top.setFieldHash(sbh("blah"), sbh("fiiiirst"));

        let master = DQ.mint(42);

        master.setPopTop(top.getHash());

        assert.throws(() => master.delegateValue(43));
    });

    it("can't delegate amounts that are non-positive", async () => {
        let top = new TwistBuilder();
        top.setFieldHash(sbh("blah"), sbh("fiiiirst"));

        let master = DQ.mint(42, 10);

        master.setPopTop(top.getHash());

        assert.throws(() => master.delegateValue(0));
        assert.throws(() => master.delegateValue(-1));
    });
});

describe("Check some math", () => {

    it("units", () => {
        let x = DQ.mint(42);
        assert.equal(x.value(), 42);

        x = DQ.mint(42, 10);
        assert.equal(x.value(), 4.2);
    });

    it("is relatively safe", () => {
        let x = DQ.mint(3.14159);
        assert.equal(x.value(), 0);

        x = DQ.mint(-42);
        assert.equal(x.value(), 0);

        x = DQ.mint(1e999);
        assert.equal(x.value(), 0);

        x = DQ.mint(NaN);
        assert.equal(x.value(), 0);

    });
});
