const { ByteArray } = require("../../src/core/byte-array");
const { Twist } = require("../../src/core/twist");
const { Atoms } = require("../../src/core/atoms");
const { getAtomsFromPath, setConfig } = require("../../src/cli/bin/util");
const { initPoptop } = require("./test-utils");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs-extra");
const assert = require("assert");
const yaml = require("yaml");

describe("toda-list", async() => {
    let configPath = path.resolve(__dirname, "./.toda/config.yml");
    let config = yaml.parse(fs.readFileSync(configPath, "utf8"));
    let toda = path.resolve(__dirname, "../../src/cli/bin");
    setConfig(configPath);

    it("Should display the list of twists", async() => {
        await initPoptop(config.poptop);

        try {
            let res = execSync(`${toda}/toda create --empty --config ${configPath}`);
            let twist = new Twist(Atoms.fromBytes(new ByteArray(res)));
            let twistAbbrv = twist.getHash().serialize().slice(0, 4);
            let line = new Twist(await getAtomsFromPath(config.line));
            let lineAbbrv = line.getHash().serialize().slice(0, 4);
            let r = execSync(`${toda}/toda list --config ${configPath}`);
            let actual = new ByteArray(r).toUTF8String();

            assert(actual.indexOf(`${twistAbbrv}\t[Twist]\tAIP ${lineAbbrv} [default]\t✓ Local control`) > -1);
            assert(actual.indexOf(`${lineAbbrv}\t[Twist]\tAIP ${lineAbbrv} [default]\t✓ Local control`) > -1);
        } catch (err) {
            assert.fail(err);
        } finally {
            fs.emptyDirSync(config.store);
        }
    });
});
