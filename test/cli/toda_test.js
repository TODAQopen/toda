/*************************************************************
 * TODAQ Open: TODA File Implementation
 * Toronto 2022
 *
 * Apache License 2.0
 *************************************************************/

const { Twist } = require("../../src/core/twist");
const { getAtomsFromPath } = require("../../src/cli/bin/util");
const { initTestEnv, getTodaPath, getConfigPath, getConfig, cleanupTestEnv } = require("./test-utils");
const { execSync } = require("child_process");
const fs = require("fs-extra");
const assert = require("assert");
const path = require("path");
const yaml = require("yaml");

xdescribe("toda", async() => {
    beforeEach(initTestEnv);
    afterEach(cleanupTestEnv);

    it("Should initialize the correct files on a clean install with a local poptop", async() => {
        try {
            execSync(`${getTodaPath()}/toda --config ${getConfigPath()}`);

            let line = new Twist(await getAtomsFromPath(getConfig().line));
            let poptop = new Twist(await getAtomsFromPath(getConfig().poptop));

            assert(fs.existsSync(getConfig().salt));
            assert(fs.existsSync(getConfig().publicKey));
            assert(fs.existsSync(getConfig().privateKey));
            assert(fs.existsSync(getConfig().line));

            assert(line.getBody().getTetherHash().equals(poptop.getHash()));
        } catch (err) {
            assert.fail(err);
        }
    });

    it("Should initialize the correct files on a clean install with an external poptop", async() => {
        try {
            let cfgPath = path.resolve(__dirname, "./.toda/config_external_pt.yml");
            let cfg = yaml.parse(fs.readFileSync(cfgPath, "utf8"));
            execSync(`${getTodaPath()}/toda --config ${cfgPath}`);

            let line = new Twist(await getAtomsFromPath(cfg.line));

            assert(fs.existsSync(getConfig().salt));
            assert(fs.existsSync(getConfig().publicKey));
            assert(fs.existsSync(getConfig().privateKey));
            assert(fs.existsSync(getConfig().line));

            assert(line.getBody().getTetherHash().toString() === cfg.poptop);
        } catch (err) {
            assert.fail(err);
        }
    });
});
