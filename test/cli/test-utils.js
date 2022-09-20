const { create } = require("../../src/cli/bin/helpers/twist");
const fs = require("fs-extra");

// Initializes the poptop if the path is local
async function initPoptop(config, shield, req, tether, pk, cargo) {
    try {
        return new URL(config.poptop);
    } catch (e) {
        let pt = await create(shield, req, tether, pk, cargo, config);
        fs.outputFileSync(config.poptop, pt.serialize().toBytes());
    }
}

exports.initPoptop = initPoptop;
