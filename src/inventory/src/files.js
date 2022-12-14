/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

let fs = require("fs/promises");
let path = require("path");
let { ByteArray } = require("../../core/byte-array");
let { Atoms } = require("../../core/atoms");

/**
 * Parses input byte-array into atoms and writes a toda file to disk. Returns the focus hash (serialized)
 * @param {string} invPath Absolute path to inventory on disk
 * @param {Buffer|ByteArray} bytes A ByteArray containing the file contents
 * @returns {ByteArray} The fucos hash of the input atom list
 */
async function putFile(invPath, bytes) {
    try {
        let atoms = Atoms.fromBytes(bytes);
        let hash = atoms.lastAtomHash();
        await fs.mkdir(path.join(invPath), {recursive: true});
        await fs.writeFile(path.join(invPath, `${hash}.toda`), bytes);
        return hash.serializedValue;
    } catch (err) {
        return Promise.reject(err);
    }
}

/**
 * Retrieve a list of *.toda files in the inventory directory
 * @param {string} invPath Absolute path to inventory on disk
 * @returns {Promise<ByteArray>} A concatenated ByteArray of their twist hashes
 */
//todo(mje): We still assume that file names match their focus hash
async function listFiles(invPath) {
    return fs.readdir(invPath)
        .catch(e => e.code == "ENOENT" ? [] : Promise.reject(e))
        .then(files =>
            files.filter(f => f.search(new RegExp(/^\S+\.toda$/, "i")) > -1)
                .map(f => new ByteArray(Buffer.from(f.replace(".toda", ""), "hex")))
                .reduce((acc, bytes) => acc.concat(bytes), new ByteArray()));
}

/**
 * Retrieve the specified .toda file by id if it exists
 * @param {string} invPath Absolute path to inventory on disk
 * @param {string} id hex encoded twist hash
 * @returns {ByteArray} A ByteArray containing the file contents
 */
async function getFile(invPath, id) {
    return fs.readFile(path.join(invPath, `${id}.toda`))
        .then(b => ByteArray.from(b))
        .catch(e => e.code == "ENOENT" ? new ByteArray() : Promise.reject(e));
}

exports.putFile = putFile;
exports.listFiles = listFiles;
exports.getFile = getFile;
