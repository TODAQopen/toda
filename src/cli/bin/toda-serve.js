#!/usr/bin/env node
/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
* 
* Apache License 2.0
*************************************************************/

const { getArgs, getConfig, formatInputs } = require("./util");
const { handleProcessException } = require("./helpers/process-exception");
const { app } = require("../../inventory/src/server");
const { execSync } = require("child_process");
const express = require("express");
const path = require("path");
const yaml = require("yaml");
const fs = require("fs-extra");
const http = require("http");

// Starts an inventory server and a web app to browse it.
void async function () {
    try {
        let args = getArgs(process);
        let config = getConfig(args["config"]);
        let inputs = await formatInputs(args);

        const projectRootPath = path.resolve(__dirname, "../../..");
        const webPath = path.join(projectRootPath, "/src/web");

        // Build the vue app, overriding any preconfigured values with args
        if (args["web"] || !args["inv"]) {
            buildWeb(projectRootPath, webPath, args["inv-url"]);
        }

        // Start the server(s)
        if (args["inv"] && !args["web"]) {
            startInventoryServer(inputs.invPath, inputs.invPort);
        } else if (args["web"] && !args["inv"]) {
            startWebServer(inputs.webPort, path.join(webPath, "/dist"));
        } else {
            if (inputs.invPort !== inputs.webPort) {
                // Run both on different ports
                let invSrv = startInventoryServer(inputs.invPath, inputs.invPort, config.maxHeaderSize);
                let webSrv = startWebServer(inputs.webPort, path.join(webPath, "/dist"));
                process.on("SIGINT", () => {
                    invSrv.close(() => {
                        webSrv.close(() => process.exit(0));
                    });
                });
            } else {
                // Run both on the same port
                let srvApp = app(inputs.invPath, { enableHostnameRouting: false });
                srvApp.use(express.static(path.join(webPath, "/dist")));
                let srv = http.createServer({ maxHeaderSize: config.maxHeaderSize }, srvApp);
                let server = srv.listen(inputs.invPort, () => {
                    console.log(`Web && Inventory server running on http://localhost:${inputs.invPort}`);
                });

                process.on("SIGINT", () => server.close(() => process.exit(0)));
            }
        }
    } catch (pe) {
        handleProcessException(process, pe);
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

function startWebServer(port, path) {
    let webApp = express();
    webApp.use(express.static(path));
    let server = webApp.listen(port, () => {
        console.log(`Web server running on http://localhost:${port}`);
    });

    process.on("SIGINT", () => server.close(() => process.exit(0)));
    return server;
}

function buildWeb(projectRootPath, webPath, invUrl) {
    console.log("Building web dist...");
    let globalConfig = yaml.parse(fs.readFileSync(path.join(projectRootPath, "/config.yml"), "utf8"));
    globalConfig.WEB.server = invUrl || globalConfig.WEB.server;
    fs.outputFileSync(path.join(webPath, "/public/config.yml"), yaml.stringify(globalConfig.WEB), {mode: 0o600});

    let buildCmd = `cd ${projectRootPath} && npm run build-web`;
    execSync(buildCmd);
}
