#!/usr/bin/env node
/*************************************************************
 * TODAQ Open: TODA File Implementation
 * Toronto 2022
 *
 * Apache License 2.0
 *************************************************************/

import { getArgs, initConfig, setConfig, getConfig, initKeys, initSalt, getVersion, getClient } from "./util.js";
import { handleProcessException, ProcessException } from "./helpers/process-exception.js";
import { spawn } from "child_process";
import fs from "fs-extra";
import chalk from "chalk";

import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Need to include this so that the interpreter gets registered
import { Capability } from "../../abject/capability.js";
import { SimpleHistoric } from "../../abject/simple-historic.js";

const MIN_NODE_VERSION = 16;

// Default outputs are binary streams
void async function () {
  try {
    if (process.versions.node.split(".")[0] < MIN_NODE_VERSION) {
        throw new ProcessException(9, `The TODA CLI requires node version ${MIN_NODE_VERSION} or greater.`);
    }

    let args = getArgs();
    let cmd = args["_"][0];
    let cmdPath = path.join(__dirname, `toda-${cmd}.js`);

    if (args["version"]) {
        return showVersion(args);
    }

    if (args["help"]) {
      return showHelp();
    }

    await init(args["config"], args["i"]);

    if (!fs.existsSync(cmdPath)) {
      process.stderr.write(chalk.red(`Received invalid toda command "${cmd}"\n`));
      return showHelp();
    }

    await new Promise(async (resolve, reject) => {
      let p = spawn(cmdPath, process.argv.slice(3), {stdio: "inherit"});

      p.on("close", (code) => {
        if (code !== 0) {
          process.exitCode = code;
          return reject();
        }

        resolve();
      });
    }).catch(() => {});
  } catch (pe) {
      handleProcessException(pe);
      //throw pe;
  }
}()

// Initializes secure keys, salt, and local line if any are missing
async function init(cfgPath, identity) {
    let config = initConfig(cfgPath);
    await initKeys(config.publicKey, config.privateKey);
    initSalt(config.salt);
    // TODO(acg): local line?
}

// If the local line specified in the config file doesn't exist, generate a new one and update the pointer
async function initLine(linePath, poptop, publicKey, pk) {
  if (!fs.existsSync(linePath)) {
    let req = {
      type: SignatureRequirement.REQ_SECP256r1,
      key: await importPublicKey(publicKey)
    };

    let tb = await create(null, req, poptop, pk, null);
    fs.outputFileSync(linePath, tb.serialize().toBytes());
  }
}

function showHelp() {
  console.log(fs.readFileSync(path.join(__dirname, "../help.txt"), "utf8"));
}

function showVersion(args) {
  console.log(`v${getVersion(args)}`);
}
