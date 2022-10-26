const { Atoms } = require("../../../core/atoms");
const { ByteArray } = require("../../../core/byte-array");
const axios = require("axios");
const { cache } = require("../caching/cache");

/**
 * If the path is a file path that exists, use that - otherwise try to ping it as a line server.
 * Caches responses from server URLs for 60s
 * @param path <String> Url to a line server or path to file
 * @param forceRecache <Boolean> Bypass the cached value
 * @returns {Promise<Atoms>}
 */
async function getLineAtoms(path, forceRecache) {
    let cacheKey = cache.getAtomKey(path);
    let cached = cache.get(cacheKey);
    if (!forceRecache && cached) {
        return cached;
    }

    let bytes = await axios({method: "get", url: path, responseType: "arraybuffer"}).then(res => new ByteArray(res.data));
    let atoms = Atoms.fromBytes(bytes);
    cache.set(cacheKey, atoms);
    return atoms;
}

exports.getLineAtoms = getLineAtoms;
