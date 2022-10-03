/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const { Abject } = require("../../abject/abject");
const { Atoms } = require("../../core/atoms");
const { NullHash, Sha256, Hash } = require("../../core/hash");
const { ByteArray } = require("../../core/byte-array");
const { Twist } = require("../../core/twist");
const { Line  } = require("../../core/line");
const { importPublicKey, importPrivateKey, createKeys } = require("../lib/pki");
const { ProcessException } = require("./helpers/process-exception");
const { formatBytes, logFormatted } = require("./helpers/formatters");
const { defaults } = require("../defaults");
const { SignatureRequirement } = require("../../core/reqsat");
const fs = require("fs-extra");
const parseArgs = require("minimist");
const yaml = require("yaml");
const path = require("path");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");


// Needed to include interpreters
const { Capability } = require("../../abject/capability");
const { SimpleHistoric } = require("../../abject/simple-historic");

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
            "inventory",
            "json",
            "latest",
            "line",
            "list",
            "packet",
            "raw",
            "rebuild",
            "refresh",
            "test",
            "web",
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
    let tether = args["tether"] || config.line;
    let privateKey = await getPrivateKey(args["i"] || config.privateKey);

    let cargo = args["cargo"] ?
        Atoms.fromBytes(new ByteArray(fs.readFileSync(args["cargo"]))) :
        null;

    let capability = args["capability"] ?
        Abject.parse(Atoms.fromBytes(getFileOrHash(args["capability"]))) :
        null;

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
    }

    let url = args["url"];
    let verb = args["verb"];
    let verbs = args["verbs"] ? args["verbs"].split(",").map(v => v.trim()).filter(v => !!v) : [];
    let expiry = args["expiry"] ? new Date(args["expiry"]) : null;
    let poptop = args["poptop"] || getLineURL(config.poptop);
    let nonce = args["nonce"] || Date.now().toString();
    let inventoryServer = args["server"] || config.inventoryServer;
    let data = args["data"] ? Buffer.from(args["data"], "hex") : null;

    const webPort = args["web-port"] || config.webPort;
    const invPort = args["inv-port"] || config.invPort;
    const invPath = args["inv-path"] || config.store;

    let inputs = {
        shield: shield,
        tether: tether,
        privateKey: privateKey,
        cargo: cargo,
        req: req,
        url: url,
        verbs: verbs,
        verb: verb,
        expiry: expiry,
        poptop: poptop,
        nonce: nonce,
        capability: capability,
        inventoryServer: inventoryServer,
        data: data,
        webPort: webPort,
        invPort: invPort,
        invPath: invPath
    };

    whitelist = whitelist || Object.keys(inputs);
    return whitelist.reduce((acc, k) => { acc[k] = inputs[k]; return acc; }, {});
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
async function initKeys(publicKey, privateKey) {
    if (!fs.existsSync(privateKey) || !fs.existsSync(publicKey)) {
        await createKeys(publicKey, privateKey);
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

/**
 * If the path is a file path that exists, use that - otherwise try to ping it as a line server.
 * @param path <String> Url to a line server or path to file
 * @returns {Promise<Atoms>}
 */
async function getAtomsFromPath(path) {
    let bytes = fs.existsSync(path)
        ? new ByteArray(fs.readFileSync(path))
        : await axios({method: "get", url: path, responseType: "arraybuffer"}).then(res => new ByteArray(res.data));
    return Atoms.fromBytes(bytes);
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
        let line = Line.fromBytes(fs.readFileSync(config.line));
        let lineLast = line.focuses[0].toString();
        if (lineLast.startsWith(filePath) || lineLast.endsWith(filePath)) {
            return config.line;
        }

        /** Git is smart enough to figure out what commit you’re referring
             * to if you provide the first few characters of the SHA-1 hash, as
             * long as that partial hash is at least four characters long and
             * unambiguous; that is, no other object in the object database can
             * have a hash that begins with the same prefix. */

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
    return filePath;
}

function getFileOrHash(filePath) {
    let fhp = getFileOrHashPath(filePath);

    if (fhp) {
        return new ByteArray(fs.readFileSync(`${fhp}`));
    }
    return null;
}

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

/** Returns the successor of an abject, if it exists
 * @param abject <Twist/Abject> A twist or an abject to append to
 * @returns <Twist|null> The successor twist, if it exists
 */
function getSuccessor(abject) {
    let atoms = abject instanceof Twist ? abject.getAtoms() : abject.serialize();
    let line = Line.fromAtoms(atoms);
    return line.successor(abject.getHash());
}

function generateShield(salt, hash) {
    hash = hash || new NullHash();
    return Sha256.hash(salt.concat(hash.serialize()));
}

/** Attempts to parse the atoms as an abject. If that fails, returns a Twist containing those atoms instead.
 * @param atoms <Atoms> The atoms to parse
 * @param focus <Hash|null> The focus hash
 * @returns <Abject|Twist>
 */
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
        process.stdout.write(abject.serialize().toBytes());
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

/* Parse the path as a URL and add the /line endpoint, or if it's not a URL just return the path */
//todo(mje): HACK - We should not need to make this assumption. Path should be fine to use as-is.
function getLineURL(path) {
    try {
        return new URL("/line", path).toString();
    } catch(e) {
        return path;
    }
}

/**
 * Given a Hash, iterates through the *.toda files in config.store and returns the path to the first one whose twist line
 * contains that hash.
 * @param hash <Hash> A Twist's Hash
 * @returns <String> the path to the file
 */
async function getFileNameForTwistHash(hash) {
    let files = fs.readdirSync(path.resolve(getConfig().store));
    for (let file of files.filter(f => path.extname(f) === ".toda")) {
        let p = path.resolve(getConfig().store, file);
        let l = Line.fromAtoms(await getAtomsFromPath(p));
        if (l.twistList().find(h => h.equals(hash))) {
            return p;
        }
    }
}

/**
 * Abjects can have a poptop set to a local line that isn't a SimpleHistoric. This is a getter fn to handle that.
 * If this is a Twist then we assume the configured poptop.
 * @param abject <Abject|Twist>
 * @returns <String> The Line URL of the abject's poptop, or else the path to the local line.
 */
async function getPoptopURL(abject) {
    if (!abject.popTop) {
        return getConfig().poptop;
    }

    try {
        return getLineURL(abject.getAbject(abject.popTop()).thisUrl());
    } catch(e) {
        return getFileNameForTwistHash(abject.popTop());
    }
}

exports.getArgs = getArgs;
exports.formatInputs = formatInputs;
exports.getVersion = getVersion;
exports.setConfig = setConfig;
exports.getConfig = getConfig;
exports.getPrivateKey = getPrivateKey;

exports.initConfig = initConfig;
exports.initKeys = initKeys;
exports.initSalt = initSalt;

exports.getAtomsFromPath = getAtomsFromPath;
exports.getFileOrInput = getFileOrInput;
exports.getAcceptedInputs = getAcceptedInputs;
exports.getInputBytes = getInputBytes;
exports.getDistinct = getDistinct;
exports.getPacketSize = getPacketSize;
exports.getSuccessor = getSuccessor;

exports.filePathForHash = filePathForHash;
exports.getFileOrHashPath = getFileOrHashPath;
exports.getFileOrHash = getFileOrHash;
exports.parseAbjectOrTwist = parseAbjectOrTwist;
exports.generateShield = generateShield;
exports.write = write;
exports.writeToFile = writeToFile;
exports.getLineURL = getLineURL;
exports.getPoptopURL = getPoptopURL;
