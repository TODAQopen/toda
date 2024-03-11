
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { Atoms } from '../core/atoms.js';
import { HashMap } from '../core/map.js';
import { Twist } from '../core/twist.js';
import { DQCache } from './dq_cache.js';
import { Abject } from '../abject/abject.js';
import { DQ } from '../abject/quantity.js';

// Inventories get and put serialized lists of atoms.

class InventoryClient {
    get() {

    }

    put() {

    }

    _putBytes(bytes) {
        throw new Error("not implemented");
    }

    unown() {

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
    constructor(invRoot, shouldArchive = true) {
        super();
        this.invRoot = invRoot;
        // use 'no archive' mode in some tests to avoid 
        //  pre-seeded files from being archived
        this.shouldArchive = shouldArchive;

        if (!fs.existsSync(invRoot)) {
            fs.mkdirSync(invRoot, { recursive: true });
        }

        this.files = new HashMap();
        this.twistIdx = new HashMap();

        /**
         * @type {DQCache}
         */
        this.dqCache = new DQCache(this.invRoot + "/dqCache.json");

        // xxx(acg): heavyweight operation; we could defer some of this
        // potentially.
        this._listPaths().forEach(fname => {
            this.loadFromDisk(fname.substr(0,fname.length-5)); //hack?
        });

        if (this.dqCache.isEmpty()) {
            this.rebuildDQCache();
        }
    }

    rebuildDQCache() {
        this.dqCache.clear();
        for (const f of this.listLatest()) {
            const atoms = this.getOwned(f);
            const twist = new Twist(atoms, atoms.focus);
            const abject = Abject.fromTwist(twist);
            if (abject && abject instanceof DQ) {
                this.dqCache.add(abject);
            }
        }
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
        if (!this.files.has(first) || this.files.get(first).n <= hs.length) {
            const existing = this.files.get(first)?.hash;
            if (existing && this.files.get(first).n < hs.length) {
                // the 'existing' file in the cache is old; archive it
                this.archive(existing);
            }
            this.files.set(first, {hash: twist.getHash(), n: hs.length});
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
        if (!path.resolve(p).startsWith(path.resolve(this.invRoot))) {
            throw new Error("Security: attempted to access a file outside of this inventory");
        }
        return Atoms.fromBytes(new Uint8Array(fs.readFileSync(p)));
    }

    filePathForHash(hash) {
        return path.join(this.invRoot, `${hash}.toda`);
    }

    archivePathForHash(hash) {
        return path.join(this.invRoot, "archive", `${hash}.toda`);
    }

    unownedPathForHash(hash) {
        return path.join(this.invRoot, "unowned", `${hash}.toda`);
    }

    tmpFilePathForHash(hash) {
        let tmpDir = path.join(this.invRoot, 'tmp');
        fs.mkdirSync(tmpDir, {recursive:true});
        return path.join(tmpDir, `${hash}.toda`);
    }

    _filePathToHash(f) {
        return f.split(".")[0];
    }

    getOwned(hash) {
        //TODO: is this needed?
        if (!this.twistIdx.has(hash)) {
            this.loadFromDisk(hash);
        }
        const newest = this.findLatest(hash);
        if (newest) {
            const atoms = this.loadFromDisk(newest);
            if (!atoms) {
                throw new Error(`Expected to find file ${newest} but` + 
                                " the file is not on disk");
            }
            return atoms;
        }
        return null;
    }

    findLatest(hash) {
        const first = this.twistIdx.get(hash);
        return this.files.get(first)?.hash;
    }

    get(hash) {
        return this.getOwned(hash) ??
               this._getUnowned(hash) ?? 
               this._getArchived(hash);
    } //TODO(acg): would like to see better testing of this.

    _getUnowned(hash) {
        let filePath = this.unownedPathForHash(hash);
        if (fs.existsSync(filePath)) {
            return this.getExplicitPath(filePath);
        }
        return null;
    }

    _getArchived(hash) {
        let path = this.archivePathForHash(hash);
        if (fs.existsSync(path)) {
            return this.getExplicitPath(path);
        }
        return null;
    }

    _getFromDisk(hash) {
        let filePath = this.filePathForHash(hash);
        if (fs.existsSync(filePath)) {
            return this.getExplicitPath(filePath);
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
        let tmpPath = this.tmpFilePathForHash(atoms.focus);
        fs.outputFileSync(tmpPath, atoms.toBytes());

        let destPath = explicitPath || this.filePathForHash(atoms.focus);
        // for atomic mv
        fs.renameSync(tmpPath, destPath);
        this._addAtoms(atoms);
        const abject = Abject.fromTwist(new Twist(atoms, atoms.focus));
        if (abject &&
            abject instanceof DQ &&
            !this.isArchived(atoms.focus) &&
            !this.isUnowned(atoms.focus)) {
            this.dqCache.add(abject);
        }
    }

    archive(hash) {
        const f = this.filePathForHash(hash);
        if (this.shouldArchive && fs.existsSync(f)) {
            fs.moveSync(f, this.archivePathForHash(hash), { overwrite: true });
        }
        this.dqCache.remove(hash);
    }

    unown(hash) {
        const firstHash = this.twistIdx.get(hash);
        this.dqCache.remove(hash);
        // If the hash is not in the inventory or if the most recent twist
        //  does not match `hash` return immediately (noop)
        if(!firstHash || 
           !this.files.get(firstHash).hash.equals(hash)) {
            return;
        }
        // Move the file itself
        const f = this.filePathForHash(hash);
        if (fs.existsSync(f)) {
            fs.moveSync(f, this.unownedPathForHash(hash), { overwrite: true });
        }
        // Remove any references to this file
        this.files.delete(firstHash);
        this.twistIdx.forEach((v, k) => {
            if (v.equals(firstHash)) {
                this.twistIdx.delete(k);
            }
        });
    }

    isArchived(hash) {
        const f = this.archivePathForHash(hash);
        return fs.existsSync(f);
    }

    isUnowned(hash) {
        const f = this.unownedPathForHash(hash);
        return fs.existsSync(f);
    }

    // Returns latest hashes of each file in inv
    listLatest() {
        // FIXME: Why doesn't `this.files.values()` return anything?
        return Object.keys(this.files.hashes)
                     .map(k => this.files.get(k).hash);
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

// TODO: Either kill this class or update it s.t. it implements the full
//       interface of LocalInventoryClient
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
        return Atoms.fromBytes(new Uint8Array(fs.readFileSync(p)));
    }
}

export { LocalInventoryClient };
export { RemoteInventoryClient };
export { VirtualInventoryClient };
