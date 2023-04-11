import { Capability } from "../../../src/abject/capability.js";
import { Atoms } from "../../../src/core/atoms.js";
import { Twist } from "../../../src/core/twist.js";
import { ByteArray } from "../../../src/core/byte-array.js";
import { capability, authorize, delegate } from "../../../src/cli/bin/helpers/capability.js";
import { Sha256 } from "../../../src/core/hash.js";
import { Shield } from "../../../src/core/shield.js";
import { getFileOrInput, getAtomsFromPath, setConfig } from "../../../src/cli/bin/util.js";
import { Abject } from "../../../src/abject/abject.js";
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'

xdescribe("append capability", () => {
    let store = new URL('./files', import.meta.url)
    let linePath = new URL('./cap-line.toda', store)
    let url = "http://test-url.com";
    let verbs = ["GET", "POST"];
    let expiry = new Date(1660591597);
    let shield = ByteArray.fromUtf8("foo");

    beforeEach(() => setConfig({ line: linePath, poptop: linePath, store: store }));

    it("should create a Capability with the correct properties", async () => {
        // Generate a local line
        let keyPair = await generateKey();
        let tb = await create(null, null, null, keyPair.privateKey, null);
        fs.outputFileSync(linePath, tb.serialize().toBytes());

        // Generate a Capability
        let cap = await capability(url, verbs, expiry, shield, linePath, linePath);
        let capTwist = new Twist(cap.serialize());

        assert.equal(cap.url(), url);
        assert.deepEqual(cap.methods(), verbs);
        assert.deepEqual(new Date(cap.expiry()), expiry);
        assert(cap.popTop().equals(tb.serialize().lastAtomHash()));
        assert(capTwist.tether().getHash().equals(tb.serialize().lastAtomHash()));
        assert(ByteArray.isEqual(capTwist.shield().getShapedValue(), shield));
    });

    it("should authorize a Capability correctly", async () => {
        // Generate a local line
        let keyPair = await generateKey();
        let tb = await create(null, null, null, keyPair.privateKey, null);
        fs.outputFileSync(linePath, tb.serialize().toBytes());

        // Generate a Capability

        let cap = await capability(url, verbs, expiry, shield, linePath, linePath);
        let capTwist = new Twist(cap.serialize());

        // Append to the Capability via Authorize
        let authUrl = "http://test-url.com/authlink";
        let authVerb = "GET";
        let authNonce = "foo";
        let ac = await authorize(cap, authUrl, authVerb, authNonce, null, linePath, keyPair.privateKey);

        let authCap = Abject.parse(ac.serialize());
        let authCapTwist = new Twist(authCap.serialize());
        assert.equal(authCap.url(), url);
        assert.deepEqual(authCap.methods(), verbs);
        assert.deepEqual(new Date(authCap.expiry()), expiry);
        assert(authCap.popTop().equals(tb.serialize().lastAtomHash()));
        assert.equal(authCapTwist.shield(), null);

        let authorizes = authCap.getAuthorizes();
        assert.equal(authorizes.getFieldAbject(Capability.simpleRequestAC.fieldSyms.fUrl), authUrl);
        assert.equal(authorizes.getFieldAbject(Capability.simpleRequestAC.fieldSyms.fHttpVerb), authVerb);
        assert.equal(authorizes.getFieldAbject(Capability.simpleRequestAC.fieldSyms.fNonce), authNonce);

        // Parse and verify the updated Line and hitch hoist
        let rigging = Shield.rigForHoist(capTwist.getHash(), authCap.getHash(), capTwist.shield());
        let lineBytes = await getFileOrInput(linePath);
        let lineTwist = new Twist(Atoms.fromBytes(lineBytes));
        assert(lineTwist.getBody().getRiggingHash().equals(Sha256.fromPacket(rigging)));
    });

    it("should successfully authorize capabilities pointing to a local line and handle rigging", async () => {
        // Generate a local line
        let keyPair = await generateKey();
        let tb = await create(null, null, null, keyPair.privateKey, null);
        fs.outputFileSync(linePath, tb.serialize().toBytes());

        // Generate a Capability
        let cap = await capability(url, verbs, expiry, shield, linePath, linePath);
        let capTwist = new Twist(cap.serialize());

        // Append to the Capability via Authorize
        let ac = await authorize(cap, "http://test-url.com/authlink", "GET", "foo", null, linePath, keyPair.privateKey);
        let authCap = Abject.parse(ac.serialize());
        authCap.twistBuilder.setTether(capTwist.tether()); //todo(mje)?

        let lineBytes = await getFileOrInput(linePath);
        let lineTwist = new Twist(Atoms.fromBytes(lineBytes));

        // Append again to verify the rigging trie and tether point to the hitch hoist
        let authNextUrl = "http://test-url.com/authnextlink";
        let authNextVerb = "POST";
        let authCapNext = await authorize(authCap, authNextUrl, authNextVerb, "bar", null, linePath, keyPair.privateKey);
        let authCapNextTwist = new Twist(authCapNext.serialize());

        assert(authCapNextTwist.tether().getHash().equals(lineTwist.getHash()));
        assert(authCapNextTwist.rig(capTwist.getHash()).equals(lineTwist.getHash()));
    });
});

xdescribe("delegate capability", () => {
    let store = new URL('./files', import.meta.url)
    let linePath = new URL('./cap-line.toda', store)
    let url = "http://test-url.com";
    let verbs = ["GET", "POST"];
    let expiry = new Date(1660591597);
    let shield = ByteArray.fromUtf8("foo");

    beforeEach(() => setConfig({ line: linePath, poptop: linePath, store: store }));

    it("should create a Capability delegate correctly", async () => {
    // Generate a local line
        let keyPair = await generateKey();
        let tb = await create(null, null, null, keyPair.privateKey, null);
        fs.outputFileSync(linePath, tb.serialize().toBytes());

        // Generate a Capability
        let cap = await capability(url, verbs, expiry, shield, linePath, linePath);

        // Create a delegate
        let delUrl = "http://test-url.com/authlink";
        let delVerbs = ["GET"];
        let delExpiry = new Date(1662225927000);
        let [_, da] = await delegate(cap, delUrl, delVerbs, delExpiry, shield, linePath, keyPair.privateKey);
        let del = Abject.parse(da.serialize());
        let delTwist = new Twist(da.serialize());

        assert.equal(del.url(), url);
        assert.deepEqual(del.methods(), ["POST"]);
        assert.deepEqual(del.expiry().map(d => new Date(d)), [expiry, delExpiry]);
        assert(del.popTop().equals(cap.popTop()));

        let lineTwist = await getAtomsFromPath(linePath).then(atoms => new Twist(atoms));
        assert(delTwist.tether().getHash().equals(lineTwist.prev().getHash()));
        assert(ByteArray.isEqual(delTwist.shield().getShapedValue(), shield));

        // Verify delegationChain
        assert(del.delegateComplete().first().getHash().equals(cap.getHash()));
        assert.deepEqual(del.delegationChain()[0], del.delegateOf());
        assert(del.prev().delegateInitiate().getHash().equals(cap.getHash()));
    });
});
