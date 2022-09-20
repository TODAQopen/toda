const { Twist } = require("../../src/core/twist");
const { ByteArray } = require("../../src/core/byte-array");
const { Sha256 } = require("../../src/core/hash");
const { ArbitraryPacket } = require("../../src/core/packet");
const { getAtomsFromPath, generateShield } = require("../../src/cli/bin/util");
const { initPoptop } = require("./test-utils");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs-extra");
const assert = require("assert");
const yaml = require("yaml");

describe("toda-append", async() => {
    let configPath = path.resolve(__dirname, "./.toda/config.yml");
    let config = yaml.parse(fs.readFileSync(configPath, "utf8"));
    let toda = path.resolve(__dirname, "../../src/cli/bin");

    it("Should append a twist with the correct properties", async() => {
        await initPoptop(config);
        let out = path.resolve(config.store, "toda-append.toda");

        try {
            let h = Sha256.fromBytes(ByteArray.fromStr("foo"));
            execSync(`${toda}/toda create --empty --config ${configPath} --out ${out}`);

            let prev = new Twist(await getAtomsFromPath(out));
            let saltBytes = new ByteArray(fs.readFileSync(config.salt));

            execSync(`${toda}/toda append --prev ${out} --out ${out} --tether ${h.serialize()} --config ${configPath}`);

            let twist = new Twist(await getAtomsFromPath(out));
            assert(twist.prev().getHash().equals(prev.getHash()));
            assert(twist.getBody().getTetherHash().equals(h));
            assert.deepEqual(twist.shield(), new ArbitraryPacket(generateShield(saltBytes, prev.getHash())));
        } catch (err) {
            assert.fail(err);
        } finally {
            fs.emptyDirSync(config.store);
        }
    });
});
