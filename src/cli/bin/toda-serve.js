#!/usr/bin/env node
/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import { getArgs, formatInputs } from './util';

import { handleProcessException } from './helpers/process-exception';
import { app } from '../../inventory/src/server';
import http from 'http';

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
