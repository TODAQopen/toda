import { Atoms } from "../../src/core/atoms.js";
import { Abject } from "../../src/abject/abject.js";
import { Hash } from "../../src/core/hash.js";
import { ByteArray } from "../../src/core/byte-array.js";
import fs from 'fs';

const descriptionDirectory = new URL('./descriptions', import.meta.url);

function listTests() {
    return fs.readdirSync(descriptionDirectory, function (err, files) {
        if (err) {
            throw new Error("Cannot load description files!");
        }
        return files;
    });
}

function parseColour(sym) {
    if (sym.equals(green)) {
        return "green";
    }
    if (sym.equals(yellow)) {
        return "yellow";
    }
    if (sym.equals(red)) {
        return "red";
    }
    throw Error("Unknown colour? " + sym);
}

function loadInput(fileName) {
    return fs.readFileSync(new URL('./inputs/' + fileName, import.meta.url));
}

function loadTest(fileName) {
    let bytes = new ByteArray(fs.readFileSync(
        new URL('./descriptions/' + fileName, import.meta.url)));
    let atoms = Atoms.fromBytes(bytes);
    let abj = Abject.parse(atoms, atoms.focus);
    let linkedFile = Abject.parse(atoms, abj.getFieldHash(linkedInputFile));
    return {"colour": parseColour(abj.getFieldHash(colour)),
            "moniker": Abject.parse(atoms, abj.getFieldHash(moniker)),
            "input": loadInput(linkedFile)};
}

const colour = Hash.fromHex("22c04949412ab90e79aab7c0300224f02d2456b6c4428850aced1256eddc0699e2");
const green = Hash.fromHex("22ed032bab5c6bfbde1c8efb762e8bf89e5c7de4a307b934a652be3bbcc2dda8a0");
const yellow = Hash.fromHex("223c708a180dab1e2ba2ee3b07c7b6b7fb5028d1402308c24e8f68597b86dc319c");
const red = Hash.fromHex("22e0194bb1db085d3f6675a255febf60620bdfce80ef53f5fe44c2a27ff61333a9");
const moniker = Hash.fromHex("22e71e2b7b3ca0425254c242a681b3a0d8d63f3d7c2c53bc4f98ad3271b017915d");
const linkedInputFile = Hash.fromHex("2255fb096446bb57d0f6d5410a61336a7ed4a4b5fad5c37baf1075a7b2a47763b1");

export { listTests };
export { loadTest };
export { colour };
export { moniker };