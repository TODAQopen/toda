import { defaults } from "../../src/cli/defaults.js";
import { getConfig, initConfig } from "../../src/cli/bin/util.js";
import assert from "assert";
import fs from "fs-extra";
import yaml from "yaml";

import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("getConfig", () => {
    it("should read the specified config file and use the correct defaults ", async () => {
        // Generate a config file with a subset of the default config values
        let userCfg = { foo: "bar", store: "/baz" };
        let cfgPath = `${__dirname}/helpers/files/config.yml`;
        fs.outputFileSync(cfgPath, yaml.stringify(userCfg), { mode: 0o600 });

        initConfig(cfgPath);

        let cfg = getConfig(cfgPath);
        assert.deepEqual(cfg, {...defaults, ...userCfg});

        fs.rm(cfgPath);
    });
});
