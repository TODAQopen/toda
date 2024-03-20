import { TodaClient } from "../../src/client/client.js";
import { LocalInventoryClient } from "../../src/client/inventory.js";
import { v4 as uuid } from "uuid";
import { uuidCargo } from "../util.js";
import { Sha256 } from "../../src/core/hash.js";
import { TwistBuilder } from "../../src/core/twist.js";

import assert from 'assert';

const randH = Sha256.fromHex("416ef975f0c646daa44bec0469384436ccc6cd459ac40562bd676d568187625b67");

describe("Unit test pull behaviour", async function () {
    it("Simple two-tiered test", async function() {
        const inv = new LocalInventoryClient("files/" + uuid());
        const toda = new TodaClient(inv, null);
        await toda.populateInventory();

        const t0 = await toda.create(null, null, uuidCargo());
        const t1 = await toda.append(t0);
        const t2 = await toda.append(t1);
        const t3 = await toda.append(t2);
        const t4 = await toda.append(t3);
        toda.defaultTopLineHash = t1.getHash();
        
        const f0TB = new TwistBuilder();
        f0TB.setPrevHash(randH);
        f0TB.setTetherHash(t2.getHash());
        const f0 = f0TB.twist();

        const f1TB = new TwistBuilder();
        f1TB.setPrevHash(f0.getHash());
        f1TB.setTetherHash(t3.getHash());

        const f1 = f1TB.twist();
        f1.addAtoms(f0.getAtoms());

        await toda.pull(f1, toda.defaultTopLineHash);

        assert.ok(!f1.get(t0.getHash()));
        assert.ok(f1.get(t1.getHash()));
        assert.ok(f1.get(t2.getHash()));
        assert.ok(f1.get(t3.getHash()));
        assert.ok(f1.get(t4.getHash()));
    });

    it("Simple multi-tiered test", async function() {
        const inv = new LocalInventoryClient("files/" + uuid());
        const toda = new TodaClient(inv, null);
        await toda.populateInventory();

        const t0 = await toda.create(null, null, uuidCargo());
        const t1 = await toda.append(t0);
        const t2 = await toda.append(t1);
        toda.defaultTopLineHash = t1.getHash();

        const t = () => toda.get(t0.getHash());

        const m0 = await toda.create(t2.getHash());
        const m1 = await toda.append(m0, t2.getHash());
        const t3 = await t();
        const m2 = await toda.append(m1, t3.getHash());
        const t4 = await t();
        const m3 = await toda.append(m2, t4.getHash()); 
        const t5 = await t();
        
        const f0TB = new TwistBuilder();
        f0TB.setPrevHash(randH);
        f0TB.setTetherHash(m2.getHash());
        const f0 = f0TB.twist();

        const f1TB = new TwistBuilder();
        f1TB.setPrevHash(f0.getHash());
        f1TB.setTetherHash(m3.getHash());

        const f1 = f1TB.twist();
        f1.addAtoms(f0.getAtoms());

        // FIXME: pull's behaviour is awkward. Right now it will
        //        pull backwards until it hits the defaultTopLineHash,
        //        even if a different popTopHash is specified
        toda.defaultTopLineHash = t2.getHash();
        await toda.pull(f1, toda.defaultTopLineHash);

        //Expected twists from topline
        assert.ok(!f1.get(t0.getHash()));
        assert.ok(!f1.get(t1.getHash()));
        assert.ok(f1.get(t2.getHash()));
        assert.ok(f1.get(t3.getHash()));
        assert.ok(f1.get(t4.getHash()));
        assert.ok(f1.get(t5.getHash()));

        //Expected twists from midline
        assert.ok(!f1.get(m0.getHash()));
        assert.ok(!f1.get(m1.getHash()));
        assert.ok(f1.get(m2.getHash()));
        assert.ok(f1.get(m3.getHash()));
    });

    it("Multi-tiered test with lots of loose twists", async function() {
        const inv = new LocalInventoryClient("files/" + uuid());
        const toda = new TodaClient(inv, null);
        await toda.populateInventory();

        const t0 = await toda.create(null, null, uuidCargo());
        const t1 = await toda.append(t0);
        const t2 = await toda.append(t1);
        toda.defaultTopLineHash = t1.getHash();

        const t = () => toda.get(t0.getHash());

        const m0 = await toda.create(t2.getHash());
        const m1 = await toda.append(m0, t2.getHash());
        const m1a = await toda.append(m1);
        const m1b = await toda.append(m1a);
        const t3 = await t();
        const m2 = await toda.append(m1b, t3.getHash());
        const m2a = await toda.append(m2);
        const m2b = await toda.append(m2a);
        const t4 = await t();
        const m3 = await toda.append(m2b, t4.getHash()); 
        const m3a = await toda.append(m3); 
        const t5 = await t();
        
        const f0TB = new TwistBuilder();
        f0TB.setPrevHash(randH);
        f0TB.setTetherHash(m2.getHash());
        const f0 = f0TB.twist();

        const f0aTB = new TwistBuilder();
        f0aTB.setPrevHash(f0.getHash());
        const f0a = f0aTB.twist();

        const f0bTB = new TwistBuilder();
        f0bTB.setPrevHash(f0a.getHash());
        const f0b = f0bTB.twist();

        const f1TB = new TwistBuilder();
        f1TB.setPrevHash(f0b.getHash());
        f1TB.setTetherHash(m3.getHash());

        const f1 = f1TB.twist();
        f1.addAtoms(f0.getAtoms());
        f1.addAtoms(f0a.getAtoms());
        f1.addAtoms(f0b.getAtoms());

        // FIXME: pull's behaviour is awkward. Right now it will
        //        pull backwards until it hits the defaultTopLineHash,
        //        even if a different popTopHash is specified
        toda.defaultTopLineHash = t2.getHash();
        await toda.pull(f1, toda.defaultTopLineHash);

        //Expected twists from topline
        assert.ok(!f1.get(t0.getHash()));
        assert.ok(!f1.get(t1.getHash()));
        assert.ok(f1.get(t2.getHash()));
        assert.ok(f1.get(t3.getHash()));
        assert.ok(f1.get(t4.getHash()));
        assert.ok(f1.get(t5.getHash()));

        //Expected twists from midline
        assert.ok(!f1.get(m0.getHash()));
        assert.ok(!f1.get(m1.getHash()));
        assert.ok(!f1.get(m1a.getHash()));
        assert.ok(!f1.get(m1b.getHash()));
        assert.ok(f1.get(m2.getHash()));
        assert.ok(f1.get(m2a.getHash()));
        assert.ok(f1.get(m2b.getHash()));
        assert.ok(f1.get(m3.getHash()));
        assert.ok(f1.get(m3a.getHash()));
    });
});