/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
* 
* Apache License 2.0
*************************************************************/

const { Abject } = require("../../src/abject/abject");
const { Capability } = require("../../src/abject/capability");
const { getAtomsFromPath } = require("../../src/cli/bin/util");
const { initPoptop } = require("./test-utils");
const { app } = require("../../src/inventory/src/server");
const { Twist } = require("../../src/core/twist");
const { Hash } = require("../../src/core/hash");
const { ByteArray } = require("../../src/core/byte-array");
const { Atoms } = require("../../src/core/atoms");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs-extra");
const assert = require("assert");
const yaml = require("yaml");
const http = require("http");
const util = require("node:util");
const exec = util.promisify(require("node:child_process").exec);

describe("toda-request", () => {
    let configPath = path.resolve(__dirname, "./.toda/config.yml");
    let config = yaml.parse(fs.readFileSync(configPath, "utf8"));
    let toda = path.resolve(__dirname, "../../src/cli/bin");

    it("Should authorize a Capability and make a request with it", async () => {
        await initPoptop(config);

        let srvApp = app(config.store, { enableHostnameRouting: false });
        let srv = http.createServer({ maxHeaderSize: config.maxHeaderSize }, srvApp);
        let server = srv.listen(config.invPort,  () => {
            console.log(`Inventory server running on http://localhost:${config.invPort}`);
        });

        try {
            const url = `http://localhost:${config.invPort}`;
            const verbs = "GET,PUT";
            const expiry = 1663166442098;
            let master = execSync(`${toda}/toda capability --url ${url} --verbs ${verbs} --expiry ${expiry} --config ${configPath}`);
            let masterTwist = new Twist(Atoms.fromBytes(new ByteArray(master)));
            let cap = path.resolve(config.store, `${masterTwist.getHash()}.toda`);

            let authUrl = `${url}/files`;
            let authVerb = "GET";
            let authNonce = "foobar";
            let res = await exec(`${toda}/toda request --url ${authUrl} --verb ${authVerb} --nonce ${authNonce} --capability ${cap} --config ${configPath}`, { encoding: "buffer" });
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
            fs.emptyDirSync(config.store);
        }
    });
});
