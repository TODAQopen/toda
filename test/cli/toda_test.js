import { Twist } from "../../src/core/twist.js";
import { getAtomsFromPath } from "../../src/cli/bin/util.js";
import { getTodaPath, getConfigPath, getConfig, cleanupTestEnv } from "./test-utils.js";
import { execSync } from "child_process";
import fs from "fs-extra";
import assert from "assert";
import path from "path";
import yaml from "yaml";

xdescribe("toda", async() => {
    // beforeEach(initTestEnv);
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
            let cfgPath = new URL('./.toda/config_external_pt.yml', import.meta.url)
            let cfg = yaml.parse(fs.readFileSync(cfgPath, "utf8"));
            execSync(`${getTodaPath()}/toda --config ${cfgPath}`);

            let line = new Twist(await getAtomsFromPath(cfg.line));

            assert(fs.existsSync(getConfig().salt));
            assert(fs.existsSync(getConfig().publicKey));
            assert(fs.existsSync(getConfig().privateKey));
            assert(fs.existsSync(getConfig().line));

            assert.equal(line.getBody().getTetherHash().toString(), cfg.poptop);
        } catch (err) {
            assert.fail(err);
        }
    });
});
