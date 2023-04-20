import { DI } from "../../src/abject/di.js";
import { P1Float } from '../../src/abject/primitive.js';
import { DQ } from "../../src/abject/quantity.js";
import { TwistBuilder } from "../../src/core/twist.js";
import { Shield } from "../../src/core/shield.js";
import { sbh } from "../util.js";
import { DelegableActionable } from '../../src/abject/actionable.js';
import { putFile } from "../../src/inventory/src/files.js";
import { NullHash } from "../../src/core/hash.js";

import assert from 'node:assert/strict'


function safeAddAtoms(thing, atoms) {
    let [h, p] = thing.atoms.lastAtom();
    thing.addAtoms(atoms);
    thing.atoms.forceSetLast(h, p);
}


describe("Regular minting works", () => {

    it("Can mint with no displayPrecision", async () => {
        let x = DQ.mint(42);
        assert.equal(x.quantity, 42);
        assert.equal(x.displayPrecision, 0);
        assert.equal(DQ.quantityToDisplay(x.quantity, x.displayPrecision), 42);
    });

    it("Can mint with small displayPrecision", async () => {
        let x = DQ.mint(42, 1);
        assert.equal(x.quantity, 42);
        assert.equal(x.displayPrecision, 1);
        assert.equal(DQ.quantityToDisplay(x.quantity, x.displayPrecision), 4.2);
    });

    it("Can mint with large displayPrecision", async () => {
        let x = DQ.mint(42, 15);
        assert.equal(x.quantity, 42);
        assert.equal(x.displayPrecision, 15);
        assert.equal(DQ.quantityToDisplay(x.quantity, x.displayPrecision), 4.2e-14);
    });

    xit("Can mint with mintingInfo", async () => {

        // TODO: figure out how to make this work (there's extra atoms in x.mintingInfo)

        let mi = new DI();
        mi.setAssetClass(DQ.context); // just need some arbitrary abject

        let x = DQ.mint(42, 0, mi);
        assert.equal(x.quantity, 42);
        assert.equal(x.displayPrecision, 0);
        assert.deepEqual(x.mintingInfo, mi);
    });
});

describe("Convenience functions give proper results", () => {

    it("quantityToDisplay should handle displayPrecision", () => {
        assert.equal(DQ.quantityToDisplay(1234, 0), 1234);
        assert.equal(DQ.quantityToDisplay(1234, 2), 12.34);
        assert.equal(DQ.quantityToDisplay(1234, 4), 0.1234);
        assert.equal(DQ.quantityToDisplay(1234, 6), 0.001234);
    });

    it("displayToQuantity should be nice convenience", () => {
        assert.equal(DQ.displayToQuantity(1234.00, 0), 1234);
        assert.equal(DQ.displayToQuantity(123.4, 1), 1234);
        assert.equal(DQ.displayToQuantity(12.34, 2), 1234);
        assert.equal(DQ.displayToQuantity(12.34, 1), 123);
        assert.equal(DQ.displayToQuantity(0.001234, 8), 123400);
        assert.equal(DQ.displayToQuantity(0.001234, 2), 0);
    });
});

describe("Minting throws on bad values", () => {

    it("quantity issues", () => {
        assert.throws(() => DQ.mint(3.14159));
        assert.throws(() => DQ.mint(-42));
        assert.throws(() => DQ.mint(1e53));
        assert.throws(() => DQ.mint(NaN));
        assert.throws(() => DQ.mint(Infinity));
        assert.throws(() => DQ.mint(-Infinity));
        assert.throws(() => DQ.mint("0x12"));
    });

    it("displayPrecision issues", () => {
        assert.throws(() => DQ.mint(42, 3.14159));
        assert.throws(() => DQ.mint(42, -42));
        assert.throws(() => DQ.mint(42, 1e2));
        assert.throws(() => DQ.mint(42, NaN));
        assert.throws(() => DQ.mint(42, Infinity));
        assert.throws(() => DQ.mint(42, -Infinity));
        assert.throws(() => DQ.mint(42, "0x12"));
    });

    it("displayPrecision issues", () => {
        assert.throws(() => DQ.mint(42, 3.14159));
        assert.throws(() => DQ.mint(42, -42));
        assert.throws(() => DQ.mint(42, 1e2));
        assert.throws(() => DQ.mint(42, NaN));
        assert.throws(() => DQ.mint(42, Infinity));
        assert.throws(() => DQ.mint(42, -Infinity));
        assert.throws(() => DQ.mint(42, "0x12"));
    });
});


describe("Delegation works correctly", () => {

    function delegator(from, amount, top) {
        let del = from.delegate(amount);
        del.twistBuilder.tetherHash = top.getHash();

        let fromNext = from.createSuccessor();
        fromNext.twistBuilder.tetherHash = top.getHash();
        fromNext.confirmDelegate(del);
        if(from.prev()) {
            fromNext.twistBuilder.rigging = new Map([[from.prev().getHash(), top.getHash()]]);
        }

        let delNext = del.createSuccessor();
        delNext.twistBuilder.tetherHash = top.getHash();
        delNext.completeDelegate(fromNext);

        let topNext = top.createSuccessor();
        // could... be.. nicer..
        topNext.rigging = new Map(
           [...Shield.rigForHoist(from.getHash(), fromNext.getHash(), NullHash).shapedVal,
            ...Shield.rigForHoist( del.getHash(),  delNext.getHash(), NullHash).shapedVal]);

        safeAddAtoms(delNext, topNext.serialize());
        safeAddAtoms(delNext, fromNext.serialize());

        fromNext.twistHash = fromNext.getHash();
        safeAddAtoms(fromNext, delNext.serialize());

        return [fromNext, delNext, topNext]
    }

    it("can do trivial delegation", async () => {
        let top = new TwistBuilder();
        top.setFieldHash(sbh("blah"), sbh("fiiiirst"));

        let root = DQ.mint(42);
        root.setPopTop(top.getHash());
        root.twistBuilder.tetherHash = top.getHash();

        let [rootNext, delNext, topNext] = delegator(root, 22, top);

        await delNext.checkAllRigs();

        assert.equal(delNext.quantity, 22);
        assert.equal(rootNext.quantity, 20);
    });

    it("can do multiple delegations from root", async () => {
        let top = new TwistBuilder();
        top.setFieldHash(sbh("blah"), sbh("fiiiirst"));

        let root = DQ.mint(42);
        root.setPopTop(top.getHash());
        root.twistBuilder.tetherHash = top.getHash();

        let rootNext = root, delNext, topNext = top;
        for(let i = 0; i < 10; i++) {
          ;[rootNext, delNext, topNext] = delegator(rootNext, 1, topNext);
        }

        await delNext.checkAllRigs();
        assert.equal(delNext.quantity, 1);
        assert.equal(rootNext.quantity, 32);
    });

    it("can do chained delegations", async () => {
        let top = new TwistBuilder();
        top.setFieldHash(sbh("blah"), sbh("fiiiirst"));

        let root = DQ.mint(42);
        root.setPopTop(top.getHash());
        root.twistBuilder.tetherHash = top.getHash();

        let rootNext, del, delNext = root, topNext = top;
        for(let i = 0; i < 10; i++) {
          ;[del, delNext, topNext] = delegator(delNext, 1, topNext);
          if(!rootNext)
            rootNext = del;
        }

        await delNext.checkAllRigs();
        assert.equal(delNext.quantity, 1);
        assert.equal(rootNext.quantity, 41);
        assert.equal(del.quantity, 0);
    });
});

describe("Delegation fails correctly", () => {

    let top = new TwistBuilder();
    top.setFieldHash(sbh("blah"), sbh("fiiiirst"));
    let root = DQ.mint(42, 1);
    root.setPopTop(top.getHash());

    it("can't delegate fractional amounts", async () => {
        assert.throws(() => root.delegate(4.11));
    });

    it("can't delegate amounts that are greater than the bill", async () => {
        assert.throws(() => root.delegate(43));
    });

    it("can't delegate amounts that are forbidden", async () => {
        assert.throws(() => root.delegate(0));
        assert.throws(() => root.delegate(-1));
        assert.throws(() => root.delegate(NaN));
        assert.throws(() => root.delegate("0x12"));
        assert.throws(() => root.delegate(Infinity));
        assert.throws(() => root.delegate(-Infinity));
    });
});

describe("Adversarial DQs can't break their invariants", () => {

    function evil_delegator(from, amount, top) {
        let del = from.createDelegate();
        let c = new DI();
        c.setAssetClass(DQ.context);
        // this is the evil line:
        c.setFieldAbject(DQ.context.fieldSyms.quantity, new P1Float(amount));
        del.setContext(c);
        del.twistBuilder.tetherHash = top.getHash();

        let fromNext = from.createSuccessor();
        fromNext.twistBuilder.tetherHash = top.getHash();
        fromNext.confirmDelegate(del);
        if(from.prev()) {
            fromNext.twistBuilder.rigging = new Map([[from.prev().getHash(), top.getHash()]]);
        }

        let delNext = del.createSuccessor();
        delNext.twistBuilder.tetherHash = top.getHash();
        delNext.completeDelegate(fromNext);

        let topNext = top.createSuccessor();
        // could... be.. nicer..
        topNext.rigging = new Map(
           [...Shield.rigForHoist(from.getHash(), fromNext.getHash(), NullHash).shapedVal,
            ...Shield.rigForHoist( del.getHash(),  delNext.getHash(), NullHash).shapedVal]);

        safeAddAtoms(delNext, topNext.serialize());
        safeAddAtoms(delNext, fromNext.serialize());

        fromNext.twistHash = fromNext.getHash();
        safeAddAtoms(fromNext, delNext.serialize());

        return [fromNext, delNext, topNext]
    }


    it("greater than parent is equal to parent", () => {
        let top = new TwistBuilder();
        top.setFieldHash(sbh("blah"), sbh("fiiiirst"));

        let root = DQ.mint(42);
        root.setPopTop(top.getHash());
        root.twistBuilder.tetherHash = top.getHash();

        let [rootNext, delNext, topNext] = evil_delegator(root, 100, top);

        assert.equal(delNext.quantity, 42);
        assert.equal(delNext.prev().quantity, 0);
        assert.equal(rootNext.quantity, 0);
    });

    it("should fail when weird delegate quantities are set manually", () => {
        let top = new TwistBuilder();
        top.setFieldHash(sbh("blah"), sbh("fiiiirst"));

        let root = DQ.mint(42);
        root.setPopTop(top.getHash());
        root.twistBuilder.tetherHash = top.getHash();

        let [rootNext, delNext, topNext] = evil_delegator(root, 1.23, top);

        assert.equal(delNext.quantity, 0);
        assert.equal(delNext.prev().quantity, 0);
        assert.equal(rootNext.quantity, 42);
    });

    xit("should ... when weird displayPrecision are set manually", () => {
        // TODO: check converter functions when displayPrecision is missing
    });

    xit("should fail when atoms are missing", () => {
        // TODO: really nasty tests with missing atoms for value, delegation, etc
    });

});

describe("Probe the edges of delegation", () => {

    function completor(from, del, top, options={}) {
        let fromNext = from.createSuccessor();
        fromNext.twistBuilder.tetherHash = top.getHash();
        if(!options.noConfirm)
            fromNext.confirmDelegate(del);
        if(from.prev())
            fromNext.twistBuilder.rigging = new Map([[from.prev().getHash(), top.getHash()]]);

        let delNext = del.createSuccessor();
        delNext.twistBuilder.tetherHash = top.getHash();
        if(!options.noComplete)
            delNext.completeDelegate(fromNext);

        let topNext = top.createSuccessor();
        topNext.rigging = new Map(
           [...Shield.rigForHoist(from.getHash(), fromNext.getHash(), NullHash).shapedVal,
            ...Shield.rigForHoist( del.getHash(),  delNext.getHash(), NullHash).shapedVal]);

        safeAddAtoms(delNext, topNext.serialize());
        safeAddAtoms(delNext, fromNext.serialize());

        fromNext.twistHash = fromNext.getHash();
        safeAddAtoms(fromNext, delNext.serialize());

        return [fromNext, delNext, topNext]
    }

    function buildContext(quantity) {
        let c = new DI();
        c.setAssetClass(DQ.context);
        c.setFieldAbject(DQ.context.fieldSyms.quantity, new P1Float(quantity));
        return c;
    }

    // the poptop
    let top = new TwistBuilder();
    top.setFieldHash(sbh("nonesuch"), sbh("non sequitur"));

    // the root DQ of 10000
    let root = DQ.mint(10000, 2);
    root.setPopTop(top.getHash());
    root.twistBuilder.tetherHash = top.getHash();

    // good delegate of 100
    let del = root.createDelegate();
    del.setContext(buildContext(100));
    del.twistBuilder.tetherHash = top.getHash();

    // bad delegate (bad amount)
    let del_amt = root.createDelegate();
    del_amt.setContext(buildContext(12.34));
    del_amt.twistBuilder.tetherHash = top.getHash();

    // bad delegate (never completes or confirms)
    let del_cc = root.createDelegate();
    del_cc.setContext(buildContext(100));
    del_cc.twistBuilder.tetherHash = top.getHash();

    // bad delegate (completes, never confirmed)
    let del_conf = root.createDelegate();
    del_conf.setContext(buildContext(100));
    del_conf.twistBuilder.tetherHash = top.getHash();

    // bad delegate (confirmed, never completes)
    let del_comp = root.createDelegate();
    del_comp.setContext(buildContext(100));
    del_comp.twistBuilder.tetherHash = top.getHash();

    // handled in special case test below
    // // bad delegate (double confirmation)
    // let del_dbl1 = root.createDelegate();
    // del_dbl1.setContext(buildContext(100));
    // del_dbl1.twistBuilder.tetherHash = top.getHash();

    // // bad delegate (double confirmation)
    // let del_dbl2 = root.createDelegate();
    // del_dbl2.setContext(buildContext(100));
    // del_dbl2.twistBuilder.tetherHash = top.getHash();

    // bad delegate (bad tether)
    let del_teth = root.createDelegate();
    del_teth.setContext(buildContext(100));
    del_teth.twistBuilder.tetherHash = root.getHash();

    // good delegate of 3030
    let del_3030 = root.createDelegate();
    del_3030.setContext(buildContext(3030));
    del_3030.twistBuilder.tetherHash = top.getHash();

    // Note: all those delegates initiate directly against root, and are confirmed in subsequent twists

    it("regular delegation should work", () => {
       ;[root, del, top] = completor(root, del, top)
        assert.equal(root.quantity, 9900);
        assert.equal(del.quantity, 100);
    });

    it("confirm a second time causes no changes", () => {
       ;[root, del, top] = completor(root, del, top, {noComplete: true})
        assert.equal(root.quantity, 9900);
        assert.equal(del.quantity, 100);
    });

    it("complete a second time causes no changes", () => {
       ;[root, del, top] = completor(root, del, top, {noConfirm: true})
        assert.equal(root.quantity, 9900);
        assert.equal(del.quantity, 100);
    });

    it("a second initiation causes no changes", () => {
        del.setFieldHash(DelegableActionable.fieldSyms.delegateInitiate, root.getHash());
        del = del.createSuccessor();
        assert.equal(root.quantity, 9900);
        assert.equal(del.quantity, 100);
    });

    it("full delegation a second time causes no changes", () => {
        del.setFieldHash(DelegableActionable.fieldSyms.delegateInitiate, root.getHash());
        del = del.createSuccessor();
       ;[root, del, top] = completor(root, del, top)
        assert.equal(root.quantity, 9900);
        assert.equal(del.quantity, 100);
    });

    // TODO: test confirmation on first twist

    it("bad amounts cause no changes", () => {
       ;[root, del_amt, top] = completor(root, del_amt, top)
        assert.equal(root.quantity, 9900);
        assert.equal(del_amt.quantity, 0);
    });

    it("incomplete, unconfirmed delegates cause no changes", () => {
       ;[root, del_cc, top] = completor(root, del_cc, top, {noConfirm: 1, noComplete: 1})
        assert.equal(root.quantity, 9900);
        assert.equal(del_cc.quantity, 0);
    });

    it("unconfirmed delegates cause no changes", () => {
        ;[root, del_conf, top] = completor(root, del_conf, top, {noConfirm: 1})
         assert.equal(root.quantity, 9900);
         assert.equal(del_conf.quantity, 0);
     });

     it("incomplete delegates have no value but still reduce delegator", () => {
        ;[root, del_comp, top] = completor(root, del_comp, top, {noComplete: 1})
         assert.equal(root.quantity, 9800);
         assert.equal(del_comp.quantity, 0);
     });

    it("a delegate with a broken tether still reduces delegator", () => {
       ;[root, del_teth, top] = completor(root, del_teth, top)
        assert.equal(root.quantity, 9700);
        assert.equal(del_teth.quantity, 100); // this is scary spice
        // TODO: check that this throws:
        // await del_teth.checkAllRigs();
    });

    it("regular delegation still works", () => {
        ;[root, del_3030, top] = completor(root, del_3030, top)
         assert.equal(root.quantity, 6670);
         assert.equal(del_3030.quantity, 3030);
    });

    // TODO: then examine the interactions of second level delegates

    // putFile('tttt', root.serialize().toBytes()) // for debugging

});


describe("Full special-cased tests", () => {

    it("should have zero value for unconfirmed delegates", () => {
        let top = new TwistBuilder();
        top.setFieldHash(sbh("blah"), sbh("fiiiirst"));

        let root = DQ.mint(42);
        root.setPopTop(top.getHash());
        root.twistBuilder.tetherHash = top.getHash();

        let del = root.createDelegate();
        let c = new DI();
        c.setAssetClass(DQ.context);
        c.setFieldAbject(DQ.context.fieldSyms.quantity, new P1Float(123));
        del.setContext(c);
        del.twistBuilder.tetherHash = top.getHash();

        let del2 = root.createDelegate();
        let c2 = new DI();
        c2.setAssetClass(DQ.context);
        c2.setFieldAbject(DQ.context.fieldSyms.quantity, new P1Float(321));
        del2.setContext(c2);
        del2.twistBuilder.tetherHash = top.getHash();

        let fromNext = root.createSuccessor();
        fromNext.twistBuilder.tetherHash = top.getHash();
        // Note that we're not confirming either delegate:
        // fromNext.confirmDelegate(del);
        // fromNext.confirmDelegate(del2);

        let delNext = del.createSuccessor();
        delNext.twistBuilder.tetherHash = top.getHash();
        delNext.completeDelegate(fromNext);

        let delNext2 = del2.createSuccessor();
        delNext2.twistBuilder.tetherHash = top.getHash();
        delNext2.completeDelegate(fromNext);

        let topNext = top.createSuccessor();
        // could... be.. nicer..
        topNext.rigging = new Map(
           [
            ...Shield.rigForHoist(root.getHash(), fromNext.getHash(), NullHash).shapedVal,
            ...Shield.rigForHoist( del.getHash(),  delNext.getHash(), NullHash).shapedVal,
            ...Shield.rigForHoist(root.getHash(), fromNext.getHash(), NullHash).shapedVal,
            ...Shield.rigForHoist(del2.getHash(), delNext2.getHash(), NullHash).shapedVal
           ]);

        safeAddAtoms(delNext, topNext.serialize());
        safeAddAtoms(delNext, fromNext.serialize());
        safeAddAtoms(delNext2, topNext.serialize());
        safeAddAtoms(delNext2, fromNext.serialize());

        fromNext.twistHash = fromNext.getHash();
        safeAddAtoms(fromNext, delNext.serialize());
        safeAddAtoms(fromNext, delNext2.serialize());

        assert.equal(delNext.quantity, 0);
        assert.equal(delNext2.quantity, 0);
        assert.equal(fromNext.quantity, 42);
    });


    it("should fail when doing delegate-confirm on multiple delegates simultaneously", () => {
        let top = new TwistBuilder();
        top.setFieldHash(sbh("blah"), sbh("fiiiirst"));

        let root = DQ.mint(42);
        root.setPopTop(top.getHash());
        root.twistBuilder.tetherHash = top.getHash();

        let del = root.createDelegate();
        let c = new DI();
        c.setAssetClass(DQ.context);
        c.setFieldAbject(DQ.context.fieldSyms.quantity, new P1Float(123));
        del.setContext(c);
        del.twistBuilder.tetherHash = top.getHash();

        let del2 = root.createDelegate();
        let c2 = new DI();
        c2.setAssetClass(DQ.context);
        c2.setFieldAbject(DQ.context.fieldSyms.quantity, new P1Float(321));
        del2.setContext(c2);
        del2.twistBuilder.tetherHash = top.getHash();

        let fromNext = root.createSuccessor();
        fromNext.twistBuilder.tetherHash = top.getHash();
        // Note that we're confirming both delegates:
        fromNext.confirmDelegates([del, del2])

        let delNext = del.createSuccessor();
        delNext.twistBuilder.tetherHash = top.getHash();
        delNext.completeDelegate(fromNext);

        let delNext2 = del.createSuccessor();
        delNext2.twistBuilder.tetherHash = top.getHash();
        delNext2.completeDelegate(fromNext);

        let topNext = top.createSuccessor();
        topNext.rigging = new Map(
           [
            ...Shield.rigForHoist(root.getHash(), fromNext.getHash(), NullHash).shapedVal,
            ...Shield.rigForHoist( del.getHash(),  delNext.getHash(), NullHash).shapedVal,
            ...Shield.rigForHoist(root.getHash(), fromNext.getHash(), NullHash).shapedVal,
            ...Shield.rigForHoist(del2.getHash(), delNext2.getHash(), NullHash).shapedVal
           ]);

        safeAddAtoms(delNext, topNext.serialize());
        safeAddAtoms(delNext, fromNext.serialize());
        safeAddAtoms(delNext2, topNext.serialize());
        safeAddAtoms(delNext2, fromNext.serialize());

        fromNext.twistHash = fromNext.getHash();
        safeAddAtoms(fromNext, delNext.serialize());
        safeAddAtoms(fromNext, delNext2.serialize());

        assert.equal(delNext.quantity, 0);
        assert.equal(delNext2.quantity, 0);
        assert.equal(fromNext.quantity, 42);
    });


});