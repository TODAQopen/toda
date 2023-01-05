#!/usr/bin/env node
/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const { getArgs, formatInputs } = require("./util");
const { handleProcessException } = require("./helpers/process-exception");
const { app } = require("../../inventory/src/server");
const http = require("http");

// Starts an inventory server
void async function () {
    try {
        let args = getArgs();
        let inputs = await formatInputs(args);

        // Start the server(s)
        startInventoryServer(inputs.invPath, inputs.invPort);
    } catch (pe) {
        handleProcessException(pe);
    }
}();

function startInventoryServer(invPath, port, maxHeaderSize) {
    let srvApp = app(invPath, { enableHostnameRouting: false });
    let srv = http.createServer({ maxHeaderSize: maxHeaderSize }, srvApp);
    let server = srv.listen(port, () => {
        console.log(`Inventory server running on http://localhost:${port}`);
    });

    process.on("SIGINT", () => server.close(() => process.exit(0)));
    return server;
}
