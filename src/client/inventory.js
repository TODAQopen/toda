
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { Atoms } from '../core/atoms.js';
import { HashMap } from '../core/map.js';
import { JSONFileBackedHashMap } from '../core/fsMap.js';
import { Hash } from "../core/hash.js";
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

    async unown() {

    }

    async populate() {
    }

    _writeCachesToDisk() {}
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
    constructor(invRoot, { shouldArchive = true, deleteOld = false } = {}) {
        super();
        this.invRoot = invRoot;
        // use 'no archive' mode in some tests to avoid
        //  pre-seeded files from being archived
        this.shouldArchive = shouldArchive;
        this.deleteOld = deleteOld;

        if (!fs.existsSync(invRoot)) {
            fs.mkdirSync(invRoot, { recursive: true });
        }
        const archivePath = path.join(this.invRoot, "archive");
        const unownedPath = path.join(this.invRoot, "unowned");
        if (!fs.existsSync(archivePath)) {
            fs.mkdirSync(archivePath, { recursive: true });
        }
        if (!fs.existsSync(unownedPath)) {
            fs.mkdirSync(unownedPath, { recursive: true });
        }

        // this.files, this.twistIdx, and this.dqCache are documented in:
        // ./inventory_docs.md

        // Populate these from files
        this.files = new JSONFileBackedHashMap(
            this.invRoot + "/filesCache.json",
            [],
            (obj) => {
                Object.entries(obj).forEach(([k, v]) => {
                    obj[k].hash = Hash.fromHex(v.hash);
                });
                return obj;
            }
        );
        this.twistIdx = new JSONFileBackedHashMap(
            this.invRoot + "/twistIdxCache.json",
            [],
            (obj) => {
                Object.entries(obj).forEach(([k, v]) => {
                    obj[k] = Hash.fromHex(v);
                });
                return obj;
            }
        );

        /**
         * @type {DQCache}
         */
        this.dqCache = new DQCache(this.invRoot + "/dqCache.json");
        this.inMemCache = {};
    }

    _areFileCachesCurrent() {
        // Declare caches current if all files on disk exist in the cache,
        // don't worry about potential old files in cache that aren't on disk

        // get files on disk
        const todaFiles = new Set(
            this._listPaths().map((fname) => fname.split(".toda")[0])
        );

        for (const fileName of todaFiles) {
            if (
                !this.twistIdx.has(fileName) ||
                !this.files.has(this.twistIdx.get(fileName))
            ) {
                return false;
            }
        }

        return true;
    }


    async populate() {
        if (!this._areFileCachesCurrent()) {
            // xxx(acg): heavyweight operation; we could defer some of this
            // potentially.
            this.files.clear();
            this.twistIdx.clear();

            // Do not do these in parallel, really long lines will try to load
            // in every single file at once and blow up
            for (const fname of this._listPaths()){
                const hash = fname.slice(0,fname.length-5);
                if (!this.findLatest(hash)) {
                    await this.loadFromDisk(hash);
                } else {
                    await this.archive(hash);
                }
            }
            this._writeCachesToDisk();
        }

        if (this.dqCache.isEmpty() && this.files.size) {
            await this.rebuildDQCache();
        }
    }

    _writeCachesToDisk() {
        this.twistIdx.commit();
        this.files.commit();
    }

    clearInMemoryCache() {
        this.inMemCache = {};
    }

    async rebuildDQCache() {
        this.dqCache.clear();
        for (const f of this.listLatest()) {
            const atoms = await this.getOwned(f);
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

    /**
     *  Use the indexes to determine the relevant information for _addAtoms(),
     *  rather than call twist.knownHistory() (which has to walk all the
     *  way back to the start)
     *  Assumption: `twist` does not already exist in the cache
     *
     *  firstTwist: The very first twist of this line, nTwists: The total length of this twist,
     *  newTwists: A truncated list of hashes containing only the new twists
     * @returns {{firstTwist: Hash, nTwists: Number, newTwists: Hash[]}}
     */
    _smartHistory(twist) {
        const newTwists = [];
        let prev = twist;
        let shorted;
        while (prev) {
            const ph = prev.getHash();
            if (this.findLatest(ph)) {
                shorted = ph;
                break;
            }
            newTwists.push(ph);
            prev = prev.safePrev();
        }
        let firstTwist, nTwists;
        if (shorted) {
            firstTwist = this.twistIdx.get(shorted);
            nTwists = this.files.get(firstTwist).n + newTwists.length;
        } else {
            firstTwist = newTwists[newTwists.length - 1];
            nTwists = newTwists.length;
        }
        return { firstTwist, newTwists, nTwists };
    }

    async _addAtoms(atoms) {
        const twist = new Twist(atoms, atoms.focus);
        const existingLatest = this.findLatest(atoms.focus);
        if (existingLatest && !existingLatest.equals(atoms.focus)) {
            // the 'existing' file in the cache is
            //  newer than this file; archive this
            await this.archive(atoms.focus);
        } else {
            const { firstTwist, newTwists, nTwists } = this._smartHistory(twist);
            newTwists.forEach(h => this.twistIdx.set(h, firstTwist));
            const existing = this.files.get(firstTwist);
            this.files.set(firstTwist, {hash: twist.getHash(), n: nTwists});
            if (existing && existing.n < nTwists) {
                // the 'existing' file in the cache is old; archive it
                await this.archive(existing.hash);
            }
            // else it's a new file we don't know about yet; no archiving
        }
    }

    _listPaths() {
        return fs.readdirSync(this.invRoot).
            filter(fname => fname.endsWith(".toda"));
    }

    //XXX(acg): I don't like this and would prefer just to be able to use hash
    //(even for local tethers)
    async getExplicitPath(p) {
        if (!path.resolve(p).startsWith(path.resolve(this.invRoot))) {
            throw new Error("Security: attempted to access a file outside of this inventory");
        }
        const f = await fs.readFile(p);
        return Atoms.fromBytes(new Uint8Array(f));
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

    async getOwned(hash) {
        const newest = this.findLatest(hash);
        if (newest) {
            const atoms = await this.loadFromDisk(newest);
            if (!atoms) {
                throw new Error(`Expected to find file ${newest} but` +
                                " the file is not on disk");
            }
            return atoms;
        }
        return null;
    }

    contains(hash) {
        return this.twistIdx.get(hash) ??
               fs.existsSync(this.unownedPathForHash(hash)) ??
               fs.existsSync(this.archivePathForHash(hash));
    }

    findLatest(hash) {
        const first = this.twistIdx.get(hash);
        return this.files.get(first)?.hash;
    }

    async get(hash) {
        const latest = this.findLatest(hash);
        if (latest && this.inMemCache[latest]) {
            return this.inMemCache[latest];
        }
        let file = await this.getOwned(hash);
        if (latest && file) {
            this.inMemCache[latest] = file;
        }
        if (!file) {
            file = await this._getUnowned(hash) ??
                   await this._getArchived(hash);
        }
        return file;
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

    async loadFromDisk(hash) {
        let atoms = await this._getFromDisk(hash);
        if (atoms) {
            await this._addAtoms(atoms);
        }
        return atoms;
    }

    async _write(atoms, explicitPath) {
        const tmpPath = this.tmpFilePathForHash(atoms.focus); 
        await fs.writeFile(tmpPath, atoms.toBytes(), { overwrite: true });
        let destPath = explicitPath || this.filePathForHash(atoms.focus);
        await fs.rename(tmpPath, destPath);
    }

    async put(atoms, explicitPath) {
        await this._write(atoms, explicitPath);
        await this._addAtoms(atoms);
        const abject = Abject.fromTwist(new Twist(atoms, atoms.focus));
        if (abject &&
            abject instanceof DQ &&
            !this.isArchived(atoms.focus) &&
            !this.isUnowned(atoms.focus)) {
            this.dqCache.add(abject);
        }
        this._writeCachesToDisk();
    }

    async archive(hash) {
        const f = this.filePathForHash(hash);
        if (this.shouldArchive && fs.existsSync(f)) {
            await fs.rename(f, this.archivePathForHash(hash));
        } else if (this.deleteOld && fs.existsSync(f)) {
            await fs.remove(f);
        }
        this.dqCache.remove(hash);
    }

    async unown(hash) {
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
        if (await fs.exists(f)) {
            await fs.rename(f, this.unownedPathForHash(hash));
        }
        // Remove any references to this file
        this.files.delete(firstHash);
        this._writeCachesToDisk();
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

    contains(hash) {
        return this.get(hash);
    }
}

export { LocalInventoryClient };
export { RemoteInventoryClient };
export { VirtualInventoryClient };
