// import { setConfig } from "../../src/cli/bin/util";
import { SECP256r1 } from "../../src/client/secp256r1.js";
import { LocalInventoryClient } from "../../src/client/inventory.js";
import { TodaClient } from "../../src/client/client.js";
import fs from "fs-extra";
import yaml from "yaml";

import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initializes the poptop if the path is local
/*async function initPoptop(poptop, shield, req, tether, pk, cargo) {
    try {
        return new URL(poptop);
    } catch (e) {
        let pt = await create(shield, req, tether, pk, cargo);
        fs.outputFileSync(poptop, pt.serialize().toBytes());
    }
}*/

function getTodaPath() {
    return path.resolve(__dirname, "../../src/cli/bin");
}

function getConfigPath() {
    return path.resolve(__dirname, "./.toda/config.yml");
}

function getConfig() {
    return yaml.parse(fs.readFileSync(getConfigPath(), "utf8"));
}

async function getClient() {

    let config = getConfig();
    let kp = await SECP256r1.fromDisk(config.privateKey);
    let c = new TodaClient(new LocalInventoryClient(config.store));

    c.addSatisfier(kp);
    c.shieldSalt = config.salt;
    return c;
}


/*async function initTestEnv() {
    setConfig(yaml.parse(fs.readFileSync(getConfigPath(), "utf8")));
    return initPoptop(getConfig().poptop);
}*/

function cleanupTestEnv() {
    fs.emptyDirSync(getConfig().store);
}

export { getTodaPath };
export { getConfigPath };
export { getConfig };
export { cleanupTestEnv };
export { getClient };
