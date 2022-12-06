/*************************************************************
 * TODAQ Open: TODA File Implementation
 * Toronto 2022
 *
 * Apache License 2.0
 *************************************************************/

const { Twist } = require("../../src/core/twist");
const { ByteArray } = require("../../src/core/byte-array");
const { Sha256 } = require("../../src/core/hash");
const { SignatureRequirement } = require("../../src/core/reqsat");
const { ArbitraryPacket } = require("../../src/core/packet");
const { getTodaPath, getConfigPath, getConfig, getClient } = require("./test-utils");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs-extra");
const assert = require("assert");

describe("toda-append", async () => {

    it("Should append a twist with the correct properties", async() => {
        try {

            let c = await getClient();
            c.inv.deleteAll();
            //return;
            let h = Sha256.fromBytes(ByteArray.fromStr("foo"));
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
            let publicKey = new ByteArray(Buffer.from(pubKeyBuffer));
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
        let invalidKeyPath = `${__dirname}/.toda/secure/id_secp256r1_v2`;

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
