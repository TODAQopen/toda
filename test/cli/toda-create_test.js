import { Twist } from "../../src/core/twist.js";
import { ByteArray } from "../../src/core/byte-array.js";
import { Sha256 } from "../../src/core/hash.js";
// import { ArbitraryPacket } from "../../src/core/packet";
import { Atoms } from "../../src/core/atoms.js";
import { getTodaPath, getConfigPath, getConfig } from "./test-utils.js";
import { execSync } from "child_process";
import path from "path";
import fs from "fs-extra";
import assert from "assert";

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
            let h = Sha256.fromBytes(ByteArray.fromUtf8("foo"));
            let r = execSync(`${getTodaPath()}/toda create --empty --tether ${h.toBytes()} --config ${getConfigPath()}`);
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
