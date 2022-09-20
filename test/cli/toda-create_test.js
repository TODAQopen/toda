const { Twist } = require("../../src/core/twist");
const { ByteArray } = require("../../src/core/byte-array");
const { Atoms } = require("../../src/core/atoms");
const { Sha256 } = require("../../src/core/hash");
const { ArbitraryPacket } = require("../../src/core/packet");
const { getAtomsFromPath, generateShield } = require("../../src/cli/bin/util");
const { initPoptop } = require("./test-utils");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs-extra");
const assert = require("assert");
const yaml = require("yaml");

describe("toda-create", async() => {
    let configPath = path.resolve(__dirname, "./.toda/config.yml");
    let config = yaml.parse(fs.readFileSync(configPath, "utf8"));
    let toda = path.resolve(__dirname, "../../src/cli/bin");

    it("Should create a twist with the correct properties", async() => {
        await initPoptop(config);
        let out;

        try {
            let h = Sha256.fromBytes(ByteArray.fromStr("foo"));
            let r = execSync(`${toda}/toda create --empty --tether ${h.serialize()} --config ${configPath}`);
            let rawTwist = new Twist(Atoms.fromBytes(new ByteArray(r)));
            out = path.resolve(config.store, `${rawTwist.getHash()}.toda`);

            let saltBytes = new ByteArray(fs.readFileSync(config.salt));

            let twist = new Twist(await getAtomsFromPath(out));
            assert(twist.getBody().getTetherHash().equals(h));
            assert.deepEqual(twist.shield(), new ArbitraryPacket(generateShield(saltBytes)));
            assert.deepEqual(twist, rawTwist);
        } catch (err) {
            assert.fail(err);
        } finally {
            fs.emptyDirSync(config.store);
        }
    });
});
