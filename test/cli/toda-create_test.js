/*************************************************************
 * TODAQ Open: TODA File Implementation
 * Toronto 2022
 *
 * Apache License 2.0
 *************************************************************/

const { Twist } = require("../../src/core/twist");
const { ByteArray } = require("../../src/core/byte-array");
const { Sha256 } = require("../../src/core/hash");
const { ArbitraryPacket } = require("../../src/core/packet");
const { Atoms } = require("../../src/core/atoms");

const { getTodaPath, getConfigPath, getConfig  } = require("./test-utils");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs-extra");
const assert = require("assert");

describe("toda-create", async() => {

    /** FIXME(Acg): merge- someone added another test */
    xit("Should create a twist tethered to the local line by default", async() => {
        let out;

        try {
            let r = execSync(`${getTodaPath()}/toda create --empty --config ${getConfigPath()}`);
            let rawTwist = new Twist(Atoms.fromBytes(new ByteArray(r)));
            out = path.resolve(getConfig().store, `${rawTwist.getHash()}.toda`);

            let line = new Twist(await getAtomsFromPath(getConfig().line));
            let twist = new Twist(await getAtomsFromPath(out));
            assert(twist.getBody().getTetherHash().equals(line.getHash()));
            assert.deepEqual(twist, rawTwist);
        } catch (err) {
            assert.fail(err);
        }
    });

    it("Should create a twist with the correct properties", async() => {
        let out;

        try {
            let h = Sha256.fromBytes(ByteArray.fromStr("foo"));
            let r = execSync(`${getTodaPath()}/toda create --empty --tether ${h.serialize()} --config ${getConfigPath()}`);
            let rawTwist = Twist.fromBytes(r);
            out = path.resolve(getConfig().store, `${rawTwist.getHash()}.toda`);

            let twist = Twist.fromBytes(fs.readFileSync(out));
            assert(twist.getBody().getTetherHash().equals(h));
            //let saltBytes = new ByteArray(fs.readFileSync(getConfig().salt));
            //assert.deepEqual(twist.shield(), new ArbitraryPacket(generateShield(saltBytes)));
            assert.deepEqual(twist, rawTwist);
        } catch (err) {
            assert.fail(err);
        }
    });
});
