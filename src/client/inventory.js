
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const os = require("os");

const { Atoms } = require("../core/atoms");
const { ByteArray } = require("../core/byte-array");
const { HashMap } = require("../core/map");
const { Line } = require("../core/line");


// Inventories get and put serialized lists of atoms.

class InventoryClient {
    get() {

    }

    put() {

    }

    _putBytes(bytes) {
        throw new Error("not implemented");
    }

}

class RemoteInventoryClient extends InventoryClient {

    constructor(url) {
        super();
        this.url = new URL(url);
    }

    _putBytes(bytes) {
        return axios({
            method: "POST",
            url: this.url.toString(),
            headers: { "Content-Type": "application/octet-stream" },
            // TODO(sfertman): add capability header once inventory server supports it
            responseType: "arraybuffer",
            data: Buffer.from(bytes)
        });
    }

}

class LocalInventoryClient extends InventoryClient {
    constructor(path) {
        super();
        this.invRoot = path;

        if (!fs.existsSync(path)) {
            fs.mkdirSync(path);
        }

        this.files = new HashMap();
        this.twistIdx = new HashMap();

        // xxx(acg): heavyweight operation; we could defer some of this
        // potentially.
        this._listPaths().forEach(fname => {
            this.loadFromDisk(fname.substr(0,fname.length-5)); //hack?
        });
    }

    // extremely dangerous; use only for tests.
    deleteAll() {
        if (!this.invRoot.includes(".toda/store")) {
            throw Error("not sure if I should delete this");
        }
        fs.emptyDirSync(this.invRoot);
    }

    _addAtoms(atoms) {
        let line = Line.fromAtoms(atoms);
        let firstHash = line.first(line.focus);
        let existing = this.files.get(firstHash);
        if (!line.history(line.focus) || (existing && existing.history(existing.focus).length >
                                          line.history(line.focus).length)) {
            return;
        }
        this.files.set(firstHash, line);
        for (let hash of line.history(line.focus)) {
            this.twistIdx.set(hash, firstHash);
        }
    }

    _listPaths() {
        return fs.readdirSync(this.invRoot).filter(fname => fname.endsWith(".toda"));
    }

    //XXX(acg): I don't like this and would prefer just to be able to use hash
    //(even for local tethers)
    getExplicitPath(p) {
        return Atoms.fromBytes(new ByteArray(fs.readFileSync(p)));
    }

    filePathForHash(hash) {
        return path.join(this.invRoot, `${hash}.toda`);
    }

    _filePathToHash(f) {
        return f.split(".")[0];
    }

    get(hash) {
        if (!this.twistIdx.has(hash)) {
            this.loadFromDisk(hash);
        }
        return this.files.get(this.twistIdx.get(hash))?.getAtoms();
    }

    _getFromDisk(hash) {
        let path = this.filePathForHash(hash);
        if (fs.existsSync(path)) {
            return this.getExplicitPath(path);
        }
        return null;
    }

    loadFromDisk(hash) {
        let atoms = this._getFromDisk(hash);
        if (atoms) {
            this._addAtoms(atoms);
        }
        return atoms;
    }


    put(atoms, explicitPath) {
        let destPath = explicitPath || this.filePathForHash(atoms.lastAtomHash());
        fs.outputFileSync(destPath, atoms.toBytes());
        this._addAtoms(atoms);
    }

    list() {
        return this._listPaths().map(this._filePathToHash.bind(this));
    }

    search(partialHash) {
        const allDir = fs.readdirSync(this.invRoot);
        return allDir.filter(f => f.startsWith(partialHash)).map(this._filePathToHash);
    }
}

// doens't write to disk
class VirtualInventoryClient extends InventoryClient {
    constructor() {
        super();
        this.data = new HashMap();
    }
    get(hash) {
        return this.data.get(hash);
    }
    put(hash, x) {
        return this.data.set(hash, x);
    }

    getExplicitPath(p) {
        return Atoms.fromBytes(new ByteArray(fs.readFileSync(p)));
    }

}

exports.LocalInventoryClient = LocalInventoryClient;
exports.RemoteInventoryClient = RemoteInventoryClient;
exports.VirtualInventoryClient = VirtualInventoryClient;
