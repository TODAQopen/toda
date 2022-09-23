const { create } = require("../../src/cli/bin/helpers/twist");
const fs = require("fs-extra");

// Initializes the poptop if the path is local
async function initPoptop(poptop, shield, req, tether, pk, cargo) {
    try {
        return new URL(poptop);
    } catch (e) {
        let pt = await create(shield, req, tether, pk, cargo);
        fs.outputFileSync(poptop, pt.serialize().toBytes());
    }
}

exports.initPoptop = initPoptop;
