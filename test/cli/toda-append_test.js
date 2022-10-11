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
const { getAtomsFromPath, generateShield } = require("../../src/cli/bin/util");
const { Secp256r1 } = require("../../src/core/crypto");
const { importPublicKey } = require("../../src/cli/lib/pki");
const { initTestEnv, getTodaPath, getConfigPath, getConfig, cleanupTestEnv } = require("./test-utils");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs-extra");
const assert = require("assert");

describe("toda-append", async () => {
    beforeEach(initTestEnv);
    afterEach(cleanupTestEnv);

    it("Should append a twist with the correct properties", async () => {
        let out = path.resolve(getConfig().store, "toda-append.toda");

        try {
            let h = Sha256.fromBytes(ByteArray.fromStr("foo"));
            execSync(`${getTodaPath()}/toda create --empty --config ${getConfigPath()} --out ${out}`);

            let prev = new Twist(await getAtomsFromPath(out));
            let saltBytes = new ByteArray(fs.readFileSync(getConfig().salt));

            execSync(`${getTodaPath()}/toda append ${out} --empty --out ${out} --tether ${h.serialize()} --config ${getConfigPath()}`);

            let twist = new Twist(await getAtomsFromPath(out));
            assert(twist.prev().getHash().equals(prev.getHash()));
            assert(twist.getBody().getTetherHash().equals(h));
            assert.deepEqual(twist.shield(), new ArbitraryPacket(generateShield(saltBytes, prev.getHash())));
        } catch (err) {
            assert.fail(err);
        }
    });

    it("Should append with satisfied requirements", async () => {
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

    it("Should not append if requirements cannot be satisfied", async () => {
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
