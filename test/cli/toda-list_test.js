import { ByteArray } from "../../src/core/byte-array.js";
import { Twist } from "../../src/core/twist.js";
import { Atoms } from "../../src/core/atoms.js";
import { getAtomsFromPath } from "../../src/cli/bin/util.js";
import { getTodaPath, getConfigPath, getConfig, cleanupTestEnv } from "./test-utils.js";
import { execSync } from "child_process";
import assert from "assert";

xdescribe("toda-list", async() => {
    // beforeEach(initTestEnv);
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
