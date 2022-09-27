const { Twist } = require("../../src/core/twist");
const { ByteArray } = require("../../src/core/byte-array");
const { Sha256 } = require("../../src/core/hash");
const { ArbitraryPacket } = require("../../src/core/packet");
const { getAtomsFromPath, generateShield } = require("../../src/cli/bin/util");
const { initTestEnv, getTodaPath, getConfigPath, getConfig, cleanupTestEnv } = require("./test-utils");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs-extra");
const assert = require("assert");

describe("toda-append", async () => {
    beforeEach(initTestEnv);
    afterEach(cleanupTestEnv);

    it("Should append a twist with the correct properties", async() => {
        let out = path.resolve(getConfig().store, "toda-append.toda");

        try {
            let h = Sha256.fromBytes(ByteArray.fromStr("foo"));
            execSync(`${getTodaPath()}/toda create --empty --config ${getConfigPath()} --out ${out}`);

            let prev = new Twist(await getAtomsFromPath(out));
            let saltBytes = new ByteArray(fs.readFileSync(getConfig().salt));

            execSync(`${getTodaPath()}/toda append --prev ${out} --out ${out} --tether ${h.serialize()} --config ${getConfigPath()}`);

            let twist = new Twist(await getAtomsFromPath(out));
            assert(twist.prev().getHash().equals(prev.getHash()));
            assert(twist.getBody().getTetherHash().equals(h));
            assert.deepEqual(twist.shield(), new ArbitraryPacket(generateShield(saltBytes, prev.getHash())));
        } catch (err) {
            assert.fail(err);
        }
    });
});
