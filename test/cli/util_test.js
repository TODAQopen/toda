/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const { defaults } = require("../../src/cli/defaults");
const { getConfig, initConfig } = require("../../src/cli/bin/util");
const assert = require("assert");
const fs = require("fs-extra");
const yaml = require("yaml");

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
