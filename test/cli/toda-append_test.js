import { Twist } from "../../src/core/twist.js";
import { ByteArray } from "../../src/core/byte-array.js";
import { Sha256 } from "../../src/core/hash.js";
import { SignatureRequirement } from "../../src/core/reqsat.js";
import { ArbitraryPacket } from "../../src/core/packet.js";
import { getTodaPath, getConfigPath, getConfig, getClient } from "./test-utils.js";
import { execSync } from "child_process";
import path from "path";
// import fs from "fs-extra";
import assert from "assert";

describe("toda-append", async () => {

    it("Should append a twist with the correct properties", async() => {
        try {

            let c = await getClient();
            c.inv.deleteAll();
            //return;
            let h = Sha256.fromBytes(ByteArray.fromUtf8("foo"));
            let r = execSync(`${getTodaPath()}/toda create --empty --config ${getConfigPath()}`);
            let rawTwist = Twist.fromBytes(r);

            r = execSync(`${getTodaPath()}/toda append ${rawTwist.getHash().toString('hex')} --empty --tether ${h.serialize()} --config ${getConfigPath()}`);

            let twist = Twist.fromBytes(r); //hack
            assert(twist.prev().getHash().equals(rawTwist.getHash()));
            assert(twist.getBody().getTetherHash().equals(h));

            //let saltBytes = new ByteArray(fs.readFileSync(getConfig().salt));
            //assert.deepEqual(twist.shield(), new ArbitraryPacket(generateShield(saltBytes, prev.getHash())));
        } catch (err) {
            //assert.fail(err);
            throw err;
        }
    });

    /** FIXME(acg): MERGE: where did this appear from? */
    xit("Should append with satisfied requirements", async () => {
        let out = path.resolve(getConfig().store, "toda-append.toda");

        try {
            execSync(`${getTodaPath()}/toda create --empty --config ${getConfigPath()} --out ${out} --secp256r1 ${getConfig().publicKey}`);
            execSync(`${getTodaPath()}/toda append ${out} --empty --config ${getConfigPath()} --out ${out}`);

            let pubKey = await importPublicKey(getConfig().publicKey);
            let pubKeyBuffer = await crypto.subtle.exportKey("spki", pubKey);
            let publicKey = new ByteArray(pubKeyBuffer);
            // let publicKey = ByteArray.fromUtf8(pubKeyBuffer);
            let keyPacket = new ArbitraryPacket(publicKey);
            let keyPacketHash = SignatureRequirement.DEFAULT_HASH_IMP.fromPacket(keyPacket);

            let twist = new Twist(await getAtomsFromPath(out));
            assert(twist.reqs(SignatureRequirement.REQ_SECP256r1).equals(keyPacketHash));

            assert(await Secp256r1.verify(twist.get(twist.reqs(SignatureRequirement.REQ_SECP256r1)).getShapedValue(),
                twist.get(twist.sats(SignatureRequirement.REQ_SECP256r1)).getShapedValue(),
                twist.getPacket().getBodyHash().serialize()));
        } catch (err) {
            assert.fail(err);
        }
    });

    /** FIXME(acg): MERGE: where did this come from? */
    xit("Should not append if requirements cannot be satisfied", async () => {
        let out = path.resolve(getConfig().store, "toda-append.toda");
        let invalidKeyPath = new URL('./.toda/secure/id_secp256r1_v2', import.meta.url)

        try {
            execSync(`${getTodaPath()}/toda create --empty --config ${getConfigPath()} --out ${out} --secp256r1 ${getConfig().publicKey}`);
            execSync(`${getTodaPath()}/toda append ${out} --empty --config ${getConfigPath()} --out ${out} --identity ${invalidKeyPath}`);

            assert.fail("Should not be able to append to this file.");
        } catch (err) {
            assert.equal(err.stderr.toString(), "Unable to establish local control of this file (verifying controller)\n");
            assert.equal(err.status, 8);
        }
    });
});
