/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import os from 'os';

import path from 'path';
let { port, inventory } = require("./src/util").getConfig();
import { app } from './src/server';

let server = app(path.join(os.homedir(), inventory)).listen(port, () => {
    console.log(`Inventory server running on port http://localhost:${port}`);
});

process.on("SIGINT", () => server.close(() => process.exit(0)));
