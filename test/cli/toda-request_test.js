/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const { Abject } = require("../../src/abject/abject");
const { Capability } = require("../../src/abject/capability");
const { getAtomsFromPath } = require("../../src/cli/bin/util");
const { initTestEnv, getTodaPath, getConfigPath, getConfig, cleanupTestEnv } = require("./test-utils");
const { app } = require("../../src/inventory/src/server");
const { Twist } = require("../../src/core/twist");
const { Hash } = require("../../src/core/hash");
const { ByteArray } = require("../../src/core/byte-array");
const { Atoms } = require("../../src/core/atoms");
const { execSync } = require("child_process");
const path = require("path");
const assert = require("assert");
const http = require("http");
const util = require("node:util");
const exec = util.promisify(require("node:child_process").exec);

xdescribe("toda-request", () => {
    beforeEach(initTestEnv);
    afterEach(cleanupTestEnv);

    it("Should authorize a Capability and make a request with it", async () => {
        let config = getConfig();
        let srvApp = app(getConfig().store, { enableHostnameRouting: false });
        let srv = http.createServer({ maxHeaderSize: getConfig().maxHeaderSize }, srvApp);
        let server = srv.listen(getConfig().invPort,  () => {
            console.log(`Inventory server running on http://localhost:${config.invPort}`);
        });

        try {
            const url = `http://localhost:${config.invPort}`;
            const verbs = "GET,PUT";
            const expiry = 1663166442098;
            let master = execSync(`${getTodaPath()}/toda capability --url ${url} --verbs ${verbs} --expiry ${expiry} --config ${getConfigPath()}`);
            let masterTwist = new Twist(Atoms.fromBytes(new ByteArray(master)));
            let cap = path.resolve(config.store, `${masterTwist.getHash()}.toda`);

            let authUrl = `${url}/files`;
            let authVerb = "GET";
            let authNonce = "foobar";
            let res = await exec(`${getTodaPath()}/toda request --url ${authUrl} --verb ${authVerb} --nonce ${authNonce} --capability ${cap} --config ${getConfigPath()}`, { encoding: "buffer" });
            let bytes = new ByteArray(res.stdout);

            let hashes = [];
            while (bytes.length > 0) {
                let hash = Hash.parse(bytes);
                hashes.push(hash);
                bytes = bytes.slice(hash.numBytes());
            }

            assert.equal(hashes.length, 1);

            let out = path.resolve(config.store, `${hashes[0]}.toda`);
            let rawAuthCap = await getAtomsFromPath(out);
            let authCap = Abject.parse(rawAuthCap);

            let authorizes = authCap.getAuthorizes();
            assert.equal(authorizes.getFieldAbject(Capability.simpleRequestAC.fieldSyms.fUrl), authUrl);
            assert.equal(authorizes.getFieldAbject(Capability.simpleRequestAC.fieldSyms.fHttpVerb), authVerb);
            assert.equal(authorizes.getFieldAbject(Capability.simpleRequestAC.fieldSyms.fNonce), authNonce);
            assert(authCap.prevHash().equals(masterTwist.getHash()));

        } catch (err) {
            assert.fail(err);
        } finally {
            server.close();
        }
    });
});
