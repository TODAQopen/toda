/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
* 
* Apache License 2.0
*************************************************************/

const os = require("os");

const defaults = {
    store: `${os.homedir()}/.toda/store`,
    publicKey: `${os.homedir()}/.toda/secure/id_secp256r1.pub`,
    privateKey: `${os.homedir()}/.toda/secure/id_secp256r1`,
    salt: `${os.homedir()}/.toda/secure/salt`,
    line: `${os.homedir()}/.toda/store/line.toda`,
    poptop: "https://line.todaq.net/",
    inventoryServer: "https://inventory.todaq.net",
    maxHeaderSize: 1048576,
    webPort: 3000,
    invPort: 3000,
    invUrl: "../"
};

exports.defaults = defaults;
