import { join } from "path";
import { tmpdir } from "os";
import { readFileSync, writeFileSync, mkdtempSync } from "fs";

import { SECP256r1 as secp } from "../../src/client/secp256r1.js";

async function toDisk(keypair, privateKeyPath, publicKeyPath) {
    let publicKey = await crypto.subtle.exportKey("spki", keypair.publicKey);
    let privateKey = await crypto.subtle.exportKey("pkcs8", keypair.privateKey);
    writeFileSync(
        publicKeyPath,
        keypair.constructor._toPEM(Buffer.from(publicKey), "PUBLIC KEY"),
        { mode: 0o600 }
    );

    writeFileSync(
        privateKeyPath,
        keypair.constructor._toPEM(Buffer.from(privateKey), "PRIVATE KEY"),
        { mode: 0o600 }
    );
}

describe("Key Import", () => {
    it("works", async () => {
        const dir = mkdtempSync(join(tmpdir(), "keyTestDir-"));
        const pubKeyPath = join(dir, "pub");
        const privKeyPath = join(dir, "priv");

        const key = await secp.generate();
        await toDisk(key, privKeyPath, pubKeyPath);

        new secp(
            await secp.importKey("pkcs8", readFileSync(privKeyPath)),
            await secp.importKey("spki", readFileSync(pubKeyPath))
        );
    });
});
