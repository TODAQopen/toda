/*************************************************************
 * TODAQ Open: TODA File Implementation
 * Toronto 2022
 *
 * Apache License 2.0
 *************************************************************/

const { create } = require("../../src/cli/bin/helpers/twist");
const { setConfig } = require("../../src/cli/bin/util");
const fs = require("fs-extra");
const path = require("path");
const yaml = require("yaml");

// Initializes the poptop if the path is local
async function initPoptop(poptop, shield, req, tether, pk, cargo) {
    try {
        return new URL(poptop);
    } catch (e) {
        let pt = await create(shield, req, tether, pk, cargo);
        fs.outputFileSync(poptop, pt.serialize().toBytes());
    }
}

function getTodaPath() {
    return path.resolve(__dirname, "../../src/cli/bin");
}

function getConfigPath() {
    return path.resolve(__dirname, "./.toda/config.yml");
}

function getConfig() {
    return yaml.parse(fs.readFileSync(getConfigPath(), "utf8"));
}

async function initTestEnv() {
    setConfig(yaml.parse(fs.readFileSync(getConfigPath(), "utf8")));
    return initPoptop(getConfig().poptop);
}

function cleanupTestEnv() {
    fs.emptyDirSync(getConfig().store);
}

exports.getTodaPath = getTodaPath;
exports.getConfigPath = getConfigPath;
exports.getConfig = getConfig;
exports.initTestEnv = initTestEnv;
exports.cleanupTestEnv = cleanupTestEnv;
