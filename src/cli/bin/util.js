/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import { Abject } from '../../abject/abject.js';

import { Atoms } from '../../core/atoms.js';
import { NullHash, Sha256, Hash } from '../../core/hash.js';
import { ByteArray } from '../../core/byte-array.js';
import { Twist } from '../../core/twist.js';
import { Line } from '../../core/line.js';
import { ProcessException } from './helpers/process-exception.js';
import { formatBytes, logFormatted } from './helpers/formatters.js';
import { defaults } from '../defaults.js';
import { SignatureRequirement } from '../../core/reqsat.js';
import { TodaClient } from '../../client/client.js';
import { LocalInventoryClient } from '../../client/inventory.js';
import { SECP256r1 } from '../../client/secp256r1.js';
import fs from 'fs-extra';
import parseArgs from 'minimist';
import yaml from 'yaml';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { getLineAtoms } from './helpers/http.js';
// Needed to include interpreters
import { Capability } from '../../abject/capability.js';

import { SimpleHistoric } from '../../abject/simple-historic.js';

import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


/** Parses and returns the process args using minimist, applying defaults and formatting
 * @param argDefaults <Object> A set of defaults to apply when parsing args using minimist
 * @returns <Object> A minimist args object
 */
function getArgs(argDefaults = {}) {
    let opts = {
        default: argDefaults,
        boolean: ["all",
            "auto-tether",
            "content",
            "detailed",
            "empty",
            "help",
            "human-readable",
            "json",
            "latest",
            "line",
            "list",
            "packet",
            "raw",
            "rebuild",
            "refresh",
            "test",
            "verbose"],
        alias: {
            C: "content",
            i: "identity",
            h: "human-readable",
            v: "version"
        }
    };

    return parseArgs(process.argv.slice(2), opts);
}

// TODO(acg): revisit in light of Inventory
function filePathForHash(hash) {
    return path.join(getConfig().store, `${hash}.toda`);
}

/** Given a minimist args object, format the inputs in a usable way
 * @param args <Object> A Minimist parsed args object
 * @param whitelist <Array> An array of keys representing a subset of args to return. If unspecified returns everything
 * @returns <Object> A formatted set of inputs
 */
async function formatInputs(args, whitelist) {
    let config = getConfig();

    let shield = args["shield"] ? new ByteArray(Buffer.from(args["shield"], "hex")) : null;
    let tether = args["tether"];
    if (tether) {
        tether = Hash.fromHex(tether);
    }
    // tether || config.line;

    //let privateKey = await getPrivateKey(args["i"] || config.privateKey);

    let cargo = args["cargo"] ?
        Atoms.fromBytes(new ByteArray(fs.readFileSync(args["cargo"]))) :
        null;

    let capability = args["capability"] ?
        Abject.parse(Atoms.fromBytes(getFileOrHash(args["capability"]))) :
        null;

    /*
    let req;
    if (args["secp256r1"]) {
        req = {
            type: SignatureRequirement.REQ_SECP256r1,
            key: await importPublicKey(args["secp256r1"])
        };
    } else if (args["ed25519"]) {
        req = {
            type: SignatureRequirement.REQ_ED25519,
            key: await importPublicKey(args["ed25519"])
        };
    }*/

    let url = args["url"];
    let verb = args["verb"];
    let verbs = args["verbs"] ? args["verbs"].split(",").map(v => v.trim()).filter(v => !!v) : [];
    let expiry = args["expiry"] ? new Date(args["expiry"]) : null;
    let poptop = args["poptop"] || config.poptop;
    let nonce = args["nonce"] || Date.now().toString();
    let inventoryServer = args["server"] || config.inventoryServer;
    let data = args["data"] ? Buffer.from(args["data"], "hex") : null;

    const invPort = args["inv-port"] || config.invPort;
    const invPath = args["inv-path"] || config.store;

    let inputs = {
        shield: shield,
        tether: tether,
        privateKey: config.privateKey,
        cargo: cargo,
        //req: req,
        url: url,
        verbs: verbs,
        verb: verb,
        expiry: expiry,
        poptop: poptop,
        nonce: nonce,
        capability: capability,
        inventoryServer: inventoryServer,
        data: data,
        invPort: invPort,
        invPath: invPath
    };

    whitelist = whitelist || Object.keys(inputs);
    return whitelist.reduce((acc, k) => { acc[k] = inputs[k]; return acc; }, {});
}

async function getClient() {

    let config = getConfig();
    let kp = await SECP256r1.fromDisk(config.privateKey);
    let c = new TodaClient(new LocalInventoryClient(config.store));

    if (config.relayHash) {
        c.defaultRelayHash = Hash.fromHex(config.relayHash);
    }

    c.addSatisfier(kp);
    c.shieldSalt = config.salt;
    return c;
}

function getVersion() {
    let pkg = fs.readFileSync(path.resolve(__dirname, "../../../package.json"), "utf8");
    let json = JSON.parse(pkg);
    return json.version;
}

function getDefaultConfigPath() {
    let rawCfg = fs.readFileSync(path.resolve(__dirname, "../../../config.yml"), "utf8");
    let cfg = yaml.parse(rawCfg).CLI;
    return path.join(os.homedir(), cfg.configPath);
}

/**
 * Checks that the default config.yaml exists and creates a new one if it doesn't.
 * Retrieves the user config file at the specified path arg or uses the default.
 * Any missing keys default to the values specified in defaults.js
 * @params cfgPath <String?> An optional path to a user config file.
 * @returns <Object> the parsed config object.
 */
function initConfig(cfgPath) {
    let defaultPath = getDefaultConfigPath();
    let def = yaml.stringify(defaults);
    if (!fs.existsSync(defaultPath)) {
        fs.outputFileSync(defaultPath, def, { mode: 0o600 });
    }

    let configFile = fs.readFileSync(cfgPath || defaultPath, "utf8");
    let config = yaml.parse(configFile);
    setConfig({...defaults, ...config});

    return getConfig();
}

/** Sets the process.env.config object.
 * @param cfg <Object> A json object representing the config options to set
 */
function setConfig(cfg) {
    process.env.config = yaml.stringify(cfg);
}

/** Parses the config object set on the process
 * @returns <Object> A json object containing the config values
 */
function getConfig() {
    return yaml.parse(process.env.config);
}

/** Checks that the default keys exist and creates them otherwise */
async function initKeys(publicKeyPath, privateKeyPath) {
    if (!fs.existsSync(privateKeyPath)) {
        let keyPair = await SECP256r1.generate();
        keyPair.toDisk(privateKeyPath, publicKeyPath);
    }
}

/** Checks that the default salt exists and creates it otherwise */
function initSalt(path) {
    if (!fs.existsSync(path)) {
        fs.outputFileSync(path, uuidv4());
    }
}
// Imports a private key from the specified identity arg or the default
async function getPrivateKey(identity) {
    return importPrivateKey(identity);
}

/**
 * Accepts a stream object and reads the bytes
 * @returns {ByteArray}
 */
async function getInputBytes() {
    return new Promise(function (resolve, reject) {
        const stdin = process.stdin;
        let data = new ByteArray();

        stdin.on("data", function (chunk) {
            data = data.concat(new ByteArray(Buffer.from(chunk)));
        });

        stdin.on("end", function () {
            if (data.length == 0) {
                return reject("No data was retrieved from STDIN.");
            }

            resolve(data);
        });

        stdin.on("error", reject);
    });
}

//FIXME(acg): duplicated by rigging/getLine()
/**
 * If the path is a file path that exists, use that - otherwise try to ping it as a line server.
 * @param path <String> Url to a line server or path to file
 * @param forceRecache <Boolean> Bypass the cached value
 * @returns {Promise<Atoms>}
 */
async function getAtomsFromPath(path, forceRecache) {
    if (fs.existsSync(path)) {
        return Atoms.fromBytes(new ByteArray(fs.readFileSync(path)));
    }

    return getLineAtoms(path, forceRecache);
}

function getFileOrHashPath(filePath) {
    if (!fs.existsSync(filePath)) {
        filePath = String(filePath); //hack

        // FIXME(acg): This hex checker fails on long values
        /*if (parseInt(filePath, 16).toString(16) !== filePath.toLowerCase()) {
            console.log("parse problem", filePath, filePath.toLowerCase());
            console.log(parseInt(filePath, 16), parseInt(filePath, 16).toString(16));
            return null;
            }*/

        if (filePath.length < 4) { //hex check
            logFormatted("Fuzzy matching requires minimum 4 characters");
            return null;
        }

        let config = getConfig();

        let exactFilePath = filePathForHash(filePath);
        if (fs.existsSync(exactFilePath)) {
            return exactFilePath;
        }

        if (fs.existsSync(config.line)) {
            let line = Line.fromBytes(fs.readFileSync(config.line));
            let lineLast = line.focuses[0].toString();
            if (lineLast.startsWith(filePath) || lineLast.endsWith(filePath)) {
                return config.line;
            }
        }

        /** Git is smart enough to figure out what commit you’re referring
             * to if you provide the first few characters of the SHA-1 hash, as
             * long as that partial hash is at least four characters long and
             * unambiguous; that is, no other object in the object database can
             * have a hash that begins with the same prefix. */

        if (fs.existsSync(config.store)) {
            const allDir = fs.readdirSync(config.store);
            let matches = allDir.filter(f => f.startsWith(filePath));
            if (matches.length > 1) {
                logFormatted(`Too many local matches for ${filePath}`);
                return null;
            }
            if (matches.length == 1) {
                filePath = path.join(config.store, matches[0]);
            } else {
                matches = allDir.filter(f => f.endsWith(filePath + ".toda"));
                if (matches.length > 1) {
                    logFormatted(`Too many local matches for ${filePath}`);
                    return null;
                }
                if (matches.length == 1) {
                    filePath = path.join(config.store, matches[0]);
                } else {
                    return null;
                }
            }
        }
    }
    return filePath;
}

// FIXME(acg): use inventory.
function getFileOrHash(filePath) {
    let fhp = getFileOrHashPath(filePath);

    if (fhp) {
        return new ByteArray(fs.readFileSync(`${fhp}`));
    }
    return null;
}

// FIXME(acg): use inventory.

// Accepts a process object and a file path
// Reads a file at the specified source, or reads in from STDIN if none specified
// Returns ByteArray
async function getFileOrInput(filePath) {
    return new Promise(function (resolve, reject) {
        if (filePath) {
            let ba = getFileOrHash(filePath);
            if (ba) {
                return resolve(ba);
            }
            return reject(new ProcessException(2, `The specified file or hash ${filePath} could not be found.`));
        }

        return getInputBytes()
            .then(data => resolve(data))
            .catch(e => reject(new ProcessException(3, `${e}`)));
    });
}

function getAcceptedInputs(args, acceptedFields, base = {}) {
    return Object.keys(acceptedFields).reduce((obj, fieldName) => {
        return {
            ...obj,
            [fieldName]: Hash.parse(new ByteArray(Buffer.from(args[fieldName], "hex"))),
        };
    }, base);
}

/** Given an array, return an array of only the distinct elements.
 * @param arr <Array>
 * @returns <Array> the distinct values in the array
 */
function getDistinct(arr) {
    return Object.values(arr.reduce((acc, item) => { acc[item] = item; return acc; }, {}));
}

function getPacketSize(packet, friendly) {
    return friendly ? formatBytes(packet.getSize()) : packet.getSize();
}

/** Attempts to parse the atoms as an abject. If that fails, returns a Twist containing those atoms instead.
 * @param atoms <Atoms> The atoms to parse
 * @param focus <Hash|null> The focus hash
 * @returns <Abject|Twist>
 */
//todo(mje): Might be worth caching...
function parseAbjectOrTwist(atoms, focus) {
    try {
        return Abject.parse(atoms, focus);
    } catch(e) {
        return new Twist(atoms, focus);
    }
}

/** Writes either the hex hash of the abject or else the serialized bytes if piping this into another command
 * @param abject <Abject|TwistBuilder> the abject whose details to write
 */
function write(abject) {
    if (process.stdout.isTTY) {
        console.log(abject.getHash().toString());
    } else {
        let by = abject.getAtoms().toBytes();
        process.stdout.write(by);
    }
}

/** Writes the abject to a file with the specified name or the abject's hash otherwise.
 * @param abject <Abject|TwistBuilder> An abject or TwistBuilder to write
 * @param out <String?> The output file name
 */
function writeToFile(abject, out) {
    let prev = abject.getPrevHash ? abject.getPrevHash() : abject.prevHash();
    let filePath = filePathForHash(prev);
    fs.outputFileSync(out || filePath, abject.serialize().toBytes());

    if (!out) {
        fs.renameSync(filePath, filePathForHash(abject.getHash()));
    }
}

async function lockFile(path) {
    try {
        fs.openSync(`${path}.line-lock`, "ax");
    } catch (e) {
        return Promise.reject(new ProcessException(9, `The file ${path} is currently locked for editing. Please try again shortly.`));
    }
}

function releaseLock(path) {
    fs.rmSync(`${path}.line-lock`);
}

export { getClient };
export { getArgs };
export { formatInputs };
export { getVersion };
export { setConfig };
export { getConfig };
export { getPrivateKey };
export { initConfig };
export { initKeys };
export { initSalt };
export { getAtomsFromPath };
export { getFileOrInput };
export { getAcceptedInputs };
export { getInputBytes };
export { getDistinct };
export { getPacketSize };
export { filePathForHash };
export { getFileOrHashPath };
export { getFileOrHash };
export { parseAbjectOrTwist };
export { write };
export { writeToFile };
export { lockFile };
export { releaseLock };

