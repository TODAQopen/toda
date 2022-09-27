const { Twist } = require("../../src/core/twist");
const { ByteArray } = require("../../src/core/byte-array");
const { Atoms } = require("../../src/core/atoms");
const { Sha256 } = require("../../src/core/hash");
const { ArbitraryPacket } = require("../../src/core/packet");
const { getAtomsFromPath, generateShield } = require("../../src/cli/bin/util");
const { initTestEnv, getTodaPath, getConfigPath, getConfig, cleanupTestEnv } = require("./test-utils");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs-extra");
const assert = require("assert");

describe("toda-create", async() => {
    beforeEach(initTestEnv);
    afterEach(cleanupTestEnv);

    it("Should create a twist with the correct properties", async() => {
        let out;

        try {
            let h = Sha256.fromBytes(ByteArray.fromStr("foo"));
            let r = execSync(`${getTodaPath()}/toda create --empty --tether ${h.serialize()} --config ${getConfigPath()}`);
            let rawTwist = new Twist(Atoms.fromBytes(new ByteArray(r)));
            out = path.resolve(getConfig().store, `${rawTwist.getHash()}.toda`);

            let saltBytes = new ByteArray(fs.readFileSync(getConfig().salt));

            let twist = new Twist(await getAtomsFromPath(out));
            assert(twist.getBody().getTetherHash().equals(h));
            assert.deepEqual(twist.shield(), new ArbitraryPacket(generateShield(saltBytes)));
            assert.deepEqual(twist, rawTwist);
        } catch (err) {
            assert.fail(err);
        }
    });
});
