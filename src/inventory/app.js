/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
* 
* Apache License 2.0
*************************************************************/

let os = require("os");
let path = require("path");
let { port, inventory } = require("./src/util").getConfig();
let { app } = require("./src/server");

let server = app(path.join(os.homedir(), inventory)).listen(port, () => {
    console.log(`Inventory server running on port http://localhost:${port}`);
});

process.on("SIGINT", () => server.close(() => process.exit(0)));
