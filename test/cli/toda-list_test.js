/*************************************************************
 * TODAQ Open: TODA File Implementation
 * Toronto 2022
 *
 * Apache License 2.0
 *************************************************************/

const { ByteArray } = require("../../src/core/byte-array");
const { Twist } = require("../../src/core/twist");
const { Atoms } = require("../../src/core/atoms");
const { getAtomsFromPath } = require("../../src/cli/bin/util");
const { initTestEnv, getTodaPath, getConfigPath, getConfig, cleanupTestEnv } = require("./test-utils");
const { execSync } = require("child_process");
const assert = require("assert");

xdescribe("toda-list", async() => {
    beforeEach(initTestEnv);
    afterEach(cleanupTestEnv);

    it("Should display the list of twists", async() => {
        try {
            let res = execSync(`${getTodaPath()}/toda create --empty --config ${getConfigPath()}`);
            let twist = new Twist(Atoms.fromBytes(new ByteArray(res)));
            let twistAbbrv = twist.getHash().serialize().slice(0, 4);
            let line = new Twist(await getAtomsFromPath(getConfig().line));
            let lineAbbrv = line.getHash().serialize().slice(0, 4);
            let r = execSync(`${getTodaPath()}/toda list --config ${getConfigPath()}`);
            let actual = new ByteArray(r).toUTF8String();

            assert(actual.indexOf(`${twistAbbrv}\t[Twist]\tAIP ${lineAbbrv} [default]\t✓ Local control`) > -1);
            assert(actual.indexOf(`${lineAbbrv}\t[Twist]\tAIP ${lineAbbrv} [default]\t✓ Local control`) > -1);
        } catch (err) {
            assert.fail(err);
        }
    });
});
