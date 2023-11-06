
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { Atoms } from '../core/atoms.js';
import { ByteArray } from '../core/byte-array.js';
import { HashMap } from '../core/map.js';
import { Twist } from '../core/twist.js';


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
            // TODO(sfertman): add capability header 
            //  once inventory server supports it
            responseType: "arraybuffer",
            data: bytes
        });
    }

}

class LocalInventoryClient extends InventoryClient {
    constructor(path, shouldArchive = true) {
        super();
        this.invRoot = path;
        // use 'no archive' mode in some tests to avoid 
        //  pre-seeded files from being archived
        this.shouldArchive = shouldArchive;

        if (!fs.existsSync(path)) {
            fs.mkdirSync(path, { recursive: true });
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
        if (!this.invRoot.includes("toda")) {
            throw Error("not sure if I should delete this");
        }
        fs.emptyDirSync(this.invRoot);
    }

    _addAtoms(atoms) {
        const twist = new Twist(atoms, atoms.focus);
        const hs = twist.knownHistory();
        const first = hs[hs.length - 1];
        hs.forEach(h => this.twistIdx.set(h, first));
        if (!this.files.has(first) || this.files.get(first).n < hs.length) {
            const existing = this.files.get(first)?.twist.getHash();
            if (existing) {
                // the 'existing' file in the cache is old; archive it
                this.archive(existing);
            }
            this.files.set(first, {twist, n: hs.length});
        } else if (this.files.get(first).n > hs.length) {
            // the 'existing' file in the cache is 
            //  newer than this file; archive this
            this.archive(atoms.focus);
        }
    }

    _listPaths() {
        return fs.readdirSync(this.invRoot).
            filter(fname => fname.endsWith(".toda"));
    }

    //XXX(acg): I don't like this and would prefer just to be able to use hash
    //(even for local tethers)
    getExplicitPath(p) {
        return Atoms.fromBytes(new ByteArray(fs.readFileSync(p)));
    }

    filePathForHash(hash) {
        return path.join(this.invRoot, `${hash}.toda`);
    }

    archivePathForHash(hash) {
        return path.join(this.invRoot, "archive", `${hash}.toda`);
    }

    tmpFilePathForHash(hash) {
        let tmpDir = path.join(this.invRoot, 'tmp');
        fs.mkdirSync(tmpDir, {recursive:true});
        return path.join(tmpDir, `${hash}.toda`);
    }

    _filePathToHash(f) {
        return f.split(".")[0];
    }

    get(hash) {
        if (!this.twistIdx.has(hash)) {
            this.loadFromDisk(hash);
        }
        const first = this.twistIdx.get(hash);
        return this.files.get(first)?.twist.getAtoms();
    } //TODO(acg): would like to see better testing of this.

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
    }

    put(atoms, explicitPath) {
        let tmpPath = this.tmpFilePathForHash(atoms.focus);
        fs.outputFileSync(tmpPath, atoms.toBytes());

        let destPath = explicitPath || this.filePathForHash(atoms.focus);
        // for atomic mv
        fs.renameSync(tmpPath, destPath);
        this._addAtoms(atoms);
    }

    archive(hash) {
        const f = this.filePathForHash(hash);
        if (this.shouldArchive && fs.existsSync(f)) {
            fs.moveSync(f, this.archivePathForHash(hash), {overwrite: true});
        }
    }

    // Returns latest hashes of each file in inv
    listLatest() {
        // FIXME: Why doesn't `this.files.values()` return anything?
        return Object.keys(this.files.hashes)
                     .map(k => this.files.get(k).twist.getHash());
    }

    // FIXME(acg): Remove - currently only used by cli
    list() {
        return this._listPaths().map(this._filePathToHash.bind(this));
    }

    search(partialHash) {
        const allDir = fs.readdirSync(this.invRoot);
        return allDir.filter(f => f.startsWith(partialHash)).
            map(this._filePathToHash);
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

export { LocalInventoryClient };
export { RemoteInventoryClient };
export { VirtualInventoryClient };