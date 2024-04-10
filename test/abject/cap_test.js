/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import {DI} from "../../src/abject/di.js";
import {Actionable} from "../../src/abject/actionable.js";
import {Capability} from "../../src/abject/capability.js";
import {P1String, P1Date} from "../../src/abject/primitive.js";
import {Abject} from "../../src/abject/abject.js";

import {TwistBuilder} from "../../src/core/twist.js";
import { utf8ToBytes } from "../../src/core/byteUtil.js";
import {Shield} from "../../src/core/shield.js";
import {ArbitraryPacket} from "../../src/core/packet.js";
import { sbh } from "../util.js";
import assert from 'node:assert/strict';

describe("Provide cap hashes", () => {
    it("gives me hashes", () => {
        console.log("Restriction Asset Class:", Capability.simpleRestrictionAC.getHash().toString());
        console.log("Restriction URL:", Capability.simpleRestrictionAC.fieldSyms.fUrl.toString());
        console.log("Restriction HTTP Verbs:", Capability.simpleRestrictionAC.fieldSyms.fHttpVerbs.toString());
        console.log("Restriction Expiry:", Capability.simpleRestrictionAC.fieldSyms.fExpiry.toString());

        console.log("Context hash:", Actionable.fieldSyms.context.toString());

        console.log("Request Asset Class:", Capability.simpleRequestAC.getHash().toString());
        console.log("Restriction URL:", Capability.simpleRequestAC.fieldSyms.fUrl.toString());
        console.log("Restriction HTTP Verb:", Capability.simpleRequestAC.fieldSyms.fHttpVerb.toString());
        console.log("Restriction Nonce:", Capability.simpleRequestAC.fieldSyms.fNonce.toString());
    });
});

describe("Cap creation", () => {
    it("can create caps", async () => {

        let restriction = new DI();
        restriction.setAssetClass(Capability.simpleRestrictionAC);
        restriction.setFieldAbject(Capability.simpleRestrictionAC.fieldSyms.fUrl,
            new P1String("https://totallynudeavocados.xxx"));

        restriction.setFieldAbjects(Capability.simpleRestrictionAC.fieldSyms.fHttpVerbs,
            [new P1String("GET"),
                new P1String("POST"),
                new P1String("VAPOURIZE")]);

        restriction.setFieldAbject(Capability.simpleRestrictionAC.fieldSyms.fExpiry, new P1Date(new Date(42)));

        let masterCap = new Capability();

        masterCap.setFieldAbject(Actionable.fieldSyms.context, restriction);


        let top = new TwistBuilder();
        top.setFieldHash(sbh("blah"), sbh("fiiiirst"));

        masterCap.setFieldHash(Actionable.fieldSyms.popTop, top.getHash());

        let shield = new ArbitraryPacket(utf8ToBytes("shield"));

        let masterCapTwist = masterCap.buildTwist();
        masterCapTwist.tetherHash = top.getHash();
        masterCapTwist.shieldPacket = shield;

        // TODO: easier way to ask actionable to create a successor...
        let masterCapNextTwist = masterCapTwist.createSuccessor();
        masterCapNextTwist.tetherHash = top.getHash();
        masterCapNextTwist.setFieldHash(Abject.NULL, Capability.interpreter); //ugh

        let topNext = top.createSuccessor();
        topNext.rigging = Shield.rigForHoist(masterCapTwist.getHash(),
            masterCapNextTwist.getHash(),
            shield).shapedVal; //hack

        masterCapNextTwist.addAtoms(topNext.serialize());

        let latestMasterCap = Abject.parse(masterCapNextTwist.serialize());
        await latestMasterCap.checkAllRigs();

    });

    it("can make caps more easily", async () => {
        let top = new TwistBuilder();
        top.setFieldHash(sbh("blah"), sbh("fiiiirst"));

        let shield = new ArbitraryPacket(utf8ToBytes("shield"));

        let master = new Capability();
        master.restrict("https://1hourbbqrepair.de", ["GET","POST","INCINERATE"], new Date(42));
        master.setPopTop(top.getHash());
        master.twistBuilder.tetherHash = top.getHash();
        master.twistBuilder.setShield(shield);

        let masterNext = master.createSuccessor();
        masterNext.twistBuilder.tetherHash = top.getHash();

        let topNext = top.createSuccessor();
        topNext.rigging = Shield.rigForHoist(master.getHash(), masterNext.getHash(), shield).shapedVal;

        masterNext.addAtoms(topNext.serialize());
        await masterNext.checkAllRigs();



    });

    it("can delegate cap powers", async () => {
        let top = new TwistBuilder();
        top.setFieldHash(sbh("blah"), sbh("fiiiirst"));

        let shield = new ArbitraryPacket(utf8ToBytes("shield"));

        let master = new Capability();
        master.restrict("https://1hourbbqrepair.lt", ["GET","POST","INCINERATE"], new Date(42));
        master.setPopTop(top.getHash());
        master.twistBuilder.tetherHash = top.getHash();
        master.twistBuilder.setShield(shield);

        let del = master.createDelegate();
        del.twistBuilder.tetherHash = top.getHash();
        del.twistBuilder.setShield(shield);
        del.restrict("https://spicydillsandwiches.va", ["INCINERATE", "GET", "PUT"], new Date(97));

        let masterNext = master.createSuccessor();
        masterNext.twistBuilder.tetherHash = top.getHash();
        masterNext.confirmDelegate(del);

        assert.deepEqual(masterNext.expiry(), ["1970-01-01T00:00:00.042Z"]);

        let delNext = del.createSuccessor();
        delNext.twistBuilder.tetherHash = top.getHash();
        delNext.completeDelegate(masterNext);

        let topNext = top.createSuccessor();

        // could... be.. nicer..
        topNext.rigging = new Map([...Shield.rigForHoist(master.getHash(), masterNext.getHash(), shield).shapedVal,
            ...Shield.rigForHoist(del.getHash(), delNext.getHash(), shield).shapedVal]);
        delNext.addAtoms(topNext.serialize());

        assert(delNext.delegateOf().getHash().equals(masterNext.getHash()));
        await delNext.checkAllRigs();

        assert.equal(delNext.url(), "https://1hourbbqrepair.lt");
        assert.deepEqual(delNext.methods(), ["POST"]);
        assert.deepEqual(delNext.expiry(), ["1970-01-01T00:00:00.042Z", "1970-01-01T00:00:00.097Z"]);

    });

    it("can only auth for intended URL", async () => {
        let top = new TwistBuilder();
        top.setFieldHash(sbh("blah"), sbh("fiiiirst"));

        let shield = new ArbitraryPacket(utf8ToBytes("shield"));

        let master = new Capability();
        master.restrict("https://1hourbbqrepair.de", ["GET","POST","INCINERATE"], new Date(42));
        master.setPopTop(top.getHash());
        master.twistBuilder.tetherHash = top.getHash();
        master.twistBuilder.setShield(shield);

        let masterNext = master.createSuccessor();
        masterNext.twistBuilder.tetherHash = top.getHash();
        masterNext.authorize("https://rubberchickenemporium.se", "GET", "I am a nonce");

        let topNext = top.createSuccessor();
        topNext.rigging = Shield.rigForHoist(master.getHash(), masterNext.getHash(), shield).shapedVal;

        masterNext.addAtoms(topNext.serialize());

        await masterNext.getCheckedAuthorization().then(() => {
            assert(false, "Expected exception");
        }, (rej) => {
            if (rej.msg && rej.msg == "Capability cannot grant authorized HTTP resource") {
                // success
            } else {
                assert(false, "Unknown test failure");
            }
        });
    });

    it("can only auth intended method", async () => {
        let top = new TwistBuilder();
        top.setFieldHash(sbh("blah"), sbh("fiiiirst"));

        let shield = new ArbitraryPacket(utf8ToBytes("shield"));

        let master = new Capability();
        master.restrict("https://1hourbbqrepair.de", ["GET","POST","INCINERATE"], new Date(42));
        master.setPopTop(top.getHash());
        master.twistBuilder.tetherHash = top.getHash();
        master.twistBuilder.setShield(shield);

        let masterNext = master.createSuccessor();
        masterNext.twistBuilder.tetherHash = top.getHash();
        masterNext.authorize("https://1hourbbqrepair.de", "PULVERIZE", "I am a nonce");

        let topNext = top.createSuccessor();
        topNext.rigging = Shield.rigForHoist(master.getHash(), masterNext.getHash(), shield).shapedVal;

        masterNext.addAtoms(topNext.serialize());

        await masterNext.getCheckedAuthorization().then(() => {
            assert(false, "Expected exception");
        }, (rej) => {
            if (rej.msg && rej.msg == "Capability insufficient to grant authorized HTTP method") {
                // success
            } else {
                assert(false, "Unknown test failure", rej);
            }
        });
    });

    it("can auth legit requests", async () => {
        let top = new TwistBuilder();
        top.setFieldHash(sbh("blah"), sbh("fiiiirst"));

        let shield = new ArbitraryPacket(utf8ToBytes("shield"));

        let master = new Capability();
        master.restrict("https://1hourbbqrepair.de", ["GET","POST","INCINERATE"], new Date(42));
        master.setPopTop(top.getHash());
        master.twistBuilder.tetherHash = top.getHash();
        master.twistBuilder.setShield(shield);

        let masterNext = master.createSuccessor();
        masterNext.twistBuilder.tetherHash = top.getHash();
        masterNext.authorize("https://1hourbbqrepair.de", "INCINERATE", "I am a nonce");

        let topNext = top.createSuccessor();
        topNext.rigging = Shield.rigForHoist(master.getHash(), masterNext.getHash(), shield).shapedVal;

        masterNext.addAtoms(topNext.serialize());

        await masterNext.getCheckedAuthorization();
    });

});
