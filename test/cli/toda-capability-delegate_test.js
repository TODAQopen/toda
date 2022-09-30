/*************************************************************
 * TODAQ Open: TODA File Implementation
 * Toronto 2022
 *
 * Apache License 2.0
 *************************************************************/

const { Abject } = require("../../src/abject/abject");
const { Atoms } = require("../../src/core/atoms");
const { Twist } = require("../../src/core/twist");
const { ByteArray } = require("../../src/core/byte-array");
const { getAtomsFromPath, filePathForHash, getConfig } = require("../../src/cli/bin/util");
const { initTestEnv, getTodaPath, getConfigPath, cleanupTestEnv } = require("./test-utils");
const { execSync } = require("child_process");
const fs = require("fs-extra");
const assert = require("assert");

describe("toda-capability-delegate", async() => {
    beforeEach(initTestEnv);
    afterEach(cleanupTestEnv);

    it("Should create a capability delegate with the correct properties", async() => {
        try {
            const url = "http://localhost:0001";
            const verbs = "GET,POST";
            const expiry = 1660591597;
            let res = execSync(`${getTodaPath()}/toda capability --url ${url} --verbs ${verbs} --expiry ${expiry} --config ${getConfigPath()}`);
            let master = Abject.parse(Atoms.fromBytes(new ByteArray(res)));
            let out = filePathForHash(master.getHash());

            // Create delegate
            const delUrl = "http://localhost:9000/path";
            const delVerbs = "GET";
            const delExpiry = 1760591597;
            let r = execSync(`${getTodaPath()}/toda capability-delegate --capability ${out} --url ${delUrl} --verbs ${delVerbs} --expiry ${delExpiry} --config ${getConfigPath()}`);
            let delegate = Abject.parse(Atoms.fromBytes(new ByteArray(r)));
            let delegatePath = filePathForHash(delegate.getHash());

            let delegateAtoms = await getAtomsFromPath(delegatePath);
            let del = Abject.parse(delegateAtoms);
            let delTwist = new Twist(delegateAtoms);

            // Verify delegate properties
            assert.equal(del.url(), url);
            assert.deepEqual(del.methods(), ["POST"]);
            assert.deepEqual(del.expiry().map(d => new Date(d)), [new Date(expiry), new Date(delExpiry)]);
            assert(del.popTop().equals(master.popTop()));

            let lineTwist = await getAtomsFromPath(getConfig().line).then(atoms => new Twist(atoms));
            assert(delTwist.tether().getHash().equals(lineTwist.prev().getHash()));

            // Verify delegationChain.
            let updatedDelegator = Abject.parse(await getAtomsFromPath(filePathForHash(del.delegationChain()[0].getHash())));
            assert(updatedDelegator.prevHash().equals(master.getHash()));
            assert(del.delegateComplete().first().getHash().equals(master.getHash()));
            assert.deepEqual(del.delegationChain()[0], del.delegateOf());
            assert(del.prev().delegateInitiate().getHash().equals(master.getHash()));

            // Verify prev files don"t exist
            assert(!fs.existsSync(filePathForHash(master.getHash())));
            assert(!fs.existsSync(filePathForHash(del.prevHash())));
        } catch (err) {
            assert.fail(err);
        }
    });
});
