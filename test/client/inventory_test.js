import { DQ } from "../../src/abject/quantity.js";
import { Hash } from "../../src/core/hash.js";
import { LocalInventoryClient } from "../../src/client/inventory.js";
import { TwistBuilder } from "../../src/core/twist.js";

import assert from "assert";
import { v4 as uuid } from "uuid";
import fs from 'fs-extra';
import nodePath from 'path';

describe("Archive", async () => {
    it("Should properly archive file", async () => {
        const inv = new LocalInventoryClient("./files/" + uuid());
        await inv.populate();
        const t = (new TwistBuilder()).twist();
        inv.put(t.getAtoms());
        const h = t.getHash();
        assert.ok(fs.existsSync(inv.filePathForHash(h)));
        inv.archive(h);
        assert.ok(!fs.existsSync(inv.filePathForHash(h)));
        assert.ok(fs.existsSync(inv.archivePathForHash(h)));
    });

    it("Shouldn't explode if trying to archive a file that does not exist", async () => {
        const inv = new LocalInventoryClient("./files/" + uuid());
        inv.archive(Hash.fromHex("417f670328e674d0becd4aca5354574c7372f3f95e459caaf426e7516fe43688c4"));
    });
});

describe("Archives files", async () => {
    it("Archives old files during constructor()", async () => {
        const path = "./files/" + uuid();
        const inv_init = new LocalInventoryClient(path);
        await inv_init.populate();
        const t0 = (new TwistBuilder()).twist();
        const t1 = t0.createSuccessor().twist();
        const t2 = t1.createSuccessor().twist();

        // Manually save the files; don't trigger anything in '.put()'
        fs.outputFileSync(inv_init.filePathForHash(t0.getHash()),
                          t0.getAtoms().toBytes());
        fs.outputFileSync(inv_init.filePathForHash(t1.getHash()),
                          t1.getAtoms().toBytes());
        fs.outputFileSync(inv_init.filePathForHash(t2.getHash()),
                          t2.getAtoms().toBytes());

        // santity check
        assert.ok(fs.existsSync(inv_init.filePathForHash(t0.getHash())));
        assert.ok(fs.existsSync(inv_init.filePathForHash(t1.getHash())));
        assert.ok(fs.existsSync(inv_init.filePathForHash(t2.getHash())));

        // Trigger construct()
        const inv = new LocalInventoryClient(path);
        await inv.populate();

        // t0 + t1 now archived
        assert.ok(!fs.existsSync(inv_init.filePathForHash(t0.getHash())));
        assert.ok(!fs.existsSync(inv_init.filePathForHash(t1.getHash())));
        assert.ok(fs.existsSync(inv_init.filePathForHash(t2.getHash())));

        // sanity check that archive files exist as expected
        assert.ok(fs.existsSync(inv_init.archivePathForHash(t0.getHash())));
        assert.ok(fs.existsSync(inv_init.archivePathForHash(t1.getHash())));
        assert.ok(!fs.existsSync(inv_init.archivePathForHash(t2.getHash())));

        // inv still behaves as expected when asking for an archived file
        assert.ok((await inv.get(t0.getHash())).focus.equals(t2.getHash()));
    });

    it("Archives old files during put()", async () => {
        const path = "./files/" + uuid();
        const inv = new LocalInventoryClient(path);
        await inv.populate();
        const t0 = (new TwistBuilder()).twist();
        const t1 = t0.createSuccessor().twist();
        const t2 = t1.createSuccessor().twist();

        inv.put(t0.getAtoms());
        assert.ok(fs.existsSync(inv.filePathForHash(t0.getHash())));

        inv.put(t1.getAtoms());
        // t0 now archived
        assert.ok(!fs.existsSync(inv.filePathForHash(t0.getHash())));
        assert.ok(fs.existsSync(inv.filePathForHash(t1.getHash())));

        inv.put(t2.getAtoms());
        // t0 + t1 now both archived
        assert.ok(!fs.existsSync(inv.filePathForHash(t0.getHash())));
        assert.ok(!fs.existsSync(inv.filePathForHash(t1.getHash())));
        assert.ok(fs.existsSync(inv.filePathForHash(t2.getHash())));

        // sanity check that archive files exist as expected
        assert.ok(fs.existsSync(inv.archivePathForHash(t0.getHash())));
        assert.ok(fs.existsSync(inv.archivePathForHash(t1.getHash())));
        assert.ok(!fs.existsSync(inv.archivePathForHash(t2.getHash())));

        // inv still behaves as expected when asking for an archived file
        assert.ok((await inv.get(t0.getHash())).focus.equals(t2.getHash()));
    });
});

describe("Unowned file mechanism", async function() {
    it("Unown removes all references in this.files + this.twistIdx and move file", async function() {
        const path = "./files/" + uuid();
        const inv = new LocalInventoryClient(path);
        await inv.populate();
        const t0 = (new TwistBuilder()).twist();
        const t1 = t0.createSuccessor().twist();

        inv.put(t1.getAtoms());

        // sanity
        assert.ok(inv.files.has(t0.getHash()));
        assert.ok(inv.twistIdx.has(t0.getHash()));
        assert.ok(inv.twistIdx.has(t1.getHash()));
        assert.ok(fs.existsSync(inv.filePathForHash(t1.getHash())));

        inv.unown(t1.getHash());

        assert.ok(!inv.files.has(t0.getHash()));
        assert.ok(!inv.twistIdx.has(t0.getHash()));
        assert.ok(!inv.twistIdx.has(t1.getHash()));
        assert.ok(!fs.existsSync(inv.filePathForHash(t1.getHash())));
        assert.ok(fs.existsSync(inv.unownedPathForHash(t1.getHash())));
    });

    it("Unown noop if passed an older hash than known", async function() {
        const path = "./files/" + uuid();
        const inv = new LocalInventoryClient(path);
        await inv.populate();
        const t0 = (new TwistBuilder()).twist();
        const t1 = t0.createSuccessor().twist();

        inv.put(t1.getAtoms());

        // sanity
        assert.ok(inv.files.has(t0.getHash()));
        assert.ok(inv.twistIdx.has(t0.getHash()));
        assert.ok(inv.twistIdx.has(t1.getHash()));
        assert.ok(fs.existsSync(inv.filePathForHash(t1.getHash())));

        inv.unown(t0.getHash());

        assert.ok(inv.files.has(t0.getHash()));
        assert.ok(inv.twistIdx.has(t0.getHash()));
        assert.ok(inv.twistIdx.has(t1.getHash()));
        assert.ok(fs.existsSync(inv.filePathForHash(t1.getHash())));
    });

    it("Unown doesn't fail if an unknown hash is provided", async function() {
        const path = "./files/" + uuid();
        const inv = new LocalInventoryClient(path);
        await inv.populate();
        const t0 = (new TwistBuilder()).twist();
        const t1 = t0.createSuccessor().twist();
        inv.put(t1.getAtoms());
        inv.unown(Hash.fromHex("41574c7372f3f95e459caaf4267f670328e674d0becd4aca5354e7516fe43688c4"));
    });

    it("Can still get an unowned file", async function() {
        const path = "./files/" + uuid();
        const inv = new LocalInventoryClient(path);
        await inv.populate();
        const t0 = (new TwistBuilder()).twist();
        const t1 = t0.createSuccessor().twist();

        inv.put(t1.getAtoms());
        inv.unown(t0.getHash());

        const atoms = await inv.get(t1.getHash());
        assert.ok(atoms);
        assert.ok(atoms.focus.equals(t1.getHash()));
    });

    it("Can still get an unowned file (extra sanity: reinstantiate inv to rm all state)", async function() {
        const path = "./files/" + uuid();
        let inv = new LocalInventoryClient(path);
        await inv.populate();
        const t0 = (new TwistBuilder()).twist();
        const t1 = t0.createSuccessor().twist();

        inv.put(t1.getAtoms());
        inv.unown(t1.getHash());

        inv = new LocalInventoryClient(path);

        const atoms = await inv.get(t1.getHash());
        assert.ok(atoms);
        assert.ok(atoms.focus.equals(t1.getHash()));
    });

    it("Can still get an archived file (extra sanity: reinstantiate inv to rm all state)", async function() {
        const path = "./files/" + uuid();
        let inv = new LocalInventoryClient(path);
        await inv.populate();
        const t0 = (new TwistBuilder()).twist();
        const t1 = t0.createSuccessor().twist();

        inv.put(t0.getAtoms());
        inv.put(t1.getAtoms());
        inv.unown(t1.getHash());

        inv = new LocalInventoryClient(path);

        const atoms = await inv.get(t0.getHash());
        assert.ok(atoms);
        assert.ok(atoms.focus.equals(t0.getHash()));
    });
});

describe("Security test for `getExplicitPath`", async function() {
    it("Explodes if you attempt to get something in a parent directory", async function() {
        const uuidA = uuid();
        const pathA = "./files/" + uuidA;
        const pathB = "./files/" + uuid();
        const invA = new LocalInventoryClient(pathA);
        await invA.populate();
        const invB = new LocalInventoryClient(pathB);
        await invB.populate();
        const t0 = (new TwistBuilder()).twist();
        invA.put(t0.getAtoms());

        assert.rejects(() => invB._getUnowned(`../../${uuidA}/${t0.getHash()}`));
    });
});

describe("DQ Cache", async function() {
    it("put() adds to dqCache", async function() {
        const path = "./files/" + uuid();
        const inv = new LocalInventoryClient(path);
        await inv.populate();
        const dq = DQ.mint(14, 1);
        // build the DQ
        const twist = dq.buildTwist().twist();
        inv.put(twist.getAtoms());
        assert.equal(inv.dqCache.getBalance(twist.getHash()).totalQuantity,
                     14);
        assert.deepEqual(inv.dqCache.listAll().map(h => h.toString()),
                         [twist.getHash().toString()]);
    });

    it("put() automatically archives", async function() {
        const path = "./files/" + uuid();
        const inv = new LocalInventoryClient(path);
        await inv.populate();
        const dq0 = DQ.mint(14, 1);
        const twist0 = dq0.buildTwist().twist();
        const dq1 = dq0.createSuccessor();
        const twist1 = dq1.buildTwist().twist();

        inv.put(twist0.getAtoms());
        assert.equal(inv.dqCache.getBalance(twist0.getHash()).totalQuantity,
                     14);
        assert.deepEqual(inv.dqCache.listAll().map(h => h.toString()),
                         [twist0.getHash().toString()]);
        inv.put(twist1.getAtoms());
        assert.equal(inv.dqCache.getBalance(twist0.getHash()).totalQuantity,
                    14);
        assert.deepEqual(inv.dqCache.listAll().map(h => h.toString()),
                         [twist1.getHash().toString()]);
    });

    it("put() does not add to dqCache if file is old", async function() {
        const path = "./files/" + uuid();
        const inv = new LocalInventoryClient(path);
        await inv.populate();
        const dq0 = DQ.mint(14, 1);
        const twist0 = dq0.buildTwist().twist();
        const dq1 = dq0.createSuccessor();
        const twist1 = dq1.buildTwist().twist();

        inv.put(twist1.getAtoms());
        assert.equal(inv.dqCache.getBalance(twist0.getHash()).totalQuantity,
                     14);
        assert.deepEqual(inv.dqCache.listAll().map(h => h.toString()),
                         [twist1.getHash().toString()]);
        inv.put(twist0.getAtoms());
        assert.equal(inv.dqCache.getBalance(twist0.getHash()).totalQuantity,
                    14);
        assert.deepEqual(inv.dqCache.listAll().map(h => h.toString()),
                         [twist1.getHash().toString()]);
    });

    it("archive() removes files from dqCache", async function() {
        const path = "./files/" + uuid();
        const inv = new LocalInventoryClient(path);
        await inv.populate();
        const dq = DQ.mint(14, 1);
        const twist = dq.buildTwist().twist();
        inv.put(twist.getAtoms());
        // sanity
        assert.equal(inv.dqCache.getBalance(twist.getHash()).totalQuantity,
                     14);
        inv.archive(twist.getHash());
        assert.equal(inv.dqCache.getBalance(twist.getHash()),
                     null);
    });

    it("unown() removes files from dqCache", async function() {
        const path = "./files/" + uuid();
        const inv = new LocalInventoryClient(path);
        await inv.populate();
        const dq = DQ.mint(14, 1);
        const twist = dq.buildTwist().twist();
        inv.put(twist.getAtoms());
        // sanity
        assert.equal(inv.dqCache.getBalance(twist.getHash()).totalQuantity,
                     14);
        inv.unown(twist.getHash());
        assert.equal(inv.dqCache.getBalance(twist.getHash()),
                     null);
    });

    it("rebuildDQCache() correctly rebuilds cache", async function() {
        const path = "./files/" + uuid();
        const inv = new LocalInventoryClient(path);
        await inv.populate();
        const dq = DQ.mint(14, 1);
        const twist = dq.buildTwist().twist();
        inv.put(twist.getAtoms());
        assert.equal(inv.dqCache.getBalance(twist.getHash()).totalQuantity,
                     14);
        // murder the cache
        inv.dqCache.clear();
        await inv.rebuildDQCache();
        assert.equal(inv.dqCache.getBalance(twist.getHash()).totalQuantity,
                     14);
    });

    it("loading inv from disk successfully loads dqCache", async function() {
        const path = "./files/" + uuid();
        let inv = new LocalInventoryClient(path);
        await inv.populate();
        const dq = DQ.mint(14, 1);
        const twist = dq.buildTwist().twist();
        inv.put(twist.getAtoms());

        inv = new LocalInventoryClient(path);
        await inv.populate();
        assert.equal(inv.dqCache.getBalance(twist.getHash()).totalQuantity,
                     14);
    });

    it("loading inv from disk successfully rebuilds cache if cache is missing", async function() {
        const path = "./files/" + uuid();
        let inv = new LocalInventoryClient(path);
        await inv.populate();
        const dq = DQ.mint(14, 1);
        const twist = dq.buildTwist().twist();
        inv.put(twist.getAtoms());
        inv.dqCache.clear();

        inv = new LocalInventoryClient(path);
        await inv.populate();
        assert.equal(inv.dqCache.getBalance(twist.getHash()).totalQuantity,
                     14);
    });
});

describe("files and twistIdx Cache", async function () {
    const _getJSONFile = (file) => JSON.parse(fs.readFileSync(file));

    it("LocalInventoryClient can create twistIdx and files on disk", async function () {
        const path = nodePath.resolve("./files/" + uuid());
        let inv = new LocalInventoryClient(path);
        assert(inv._areFileCachesCurrent());
        await inv.populate();
        assert(inv._areFileCachesCurrent());
        const dq = DQ.mint(14, 1);
        const twist = dq.buildTwist().twist();

        inv.put(twist.getAtoms());
        inv.writeCachesToDisk();

        assert.equal(
            Object.keys(_getJSONFile(`${path}/filesCache.json`)).length,
            1
        );
        assert.equal(
            Object.keys(_getJSONFile(`${path}/twistIdxCache.json`)).length,
            1
        );
    });

    it("loading LocalInventoryClient populates twistIdx from disk", async function () {
        // create some data
        const path = nodePath.resolve("./files/" + uuid());
        let inv = new LocalInventoryClient(path);
        assert(inv._areFileCachesCurrent());
        await inv.populate();

        const dq0 = DQ.mint(1000, 1);
        const twist0 = dq0.buildTwist().twist();
        inv.put(twist0.getAtoms());

        const del = dq0.delegate(5)
        const next = dq0.createSuccessor();
        next.confirmDelegate(del);
        const twist1 = next.buildTwist().twist();
        inv.put(twist1.getAtoms());

        const del2 = next.delegate(4)
        const next2 = next.createSuccessor();
        next2.confirmDelegate(del2);
        const twist2 = next2.buildTwist().twist();
        inv.put(twist2.getAtoms());

        inv.writeCachesToDisk();
        assert(inv._areFileCachesCurrent());

        const inv2 = new LocalInventoryClient(path);
        assert(inv2._areFileCachesCurrent());

        assert.deepEqual(
            JSON.parse(JSON.stringify(Array.from(inv2.files.entries()))),
            [[twist0.hash.toString(), { hash: twist2.hash.toString(), n: 3 }]]
        );
        assert.deepEqual(
            JSON.parse(JSON.stringify(Array.from(inv2.twistIdx.entries()))),
            [[twist0.hash.toString(), twist0.hash.toString()],
             [twist1.hash.toString(), twist0.hash.toString()],
             [twist2.hash.toString(), twist0.hash.toString()]]
        );
    });

    it("popluating LocalInventoryClient with wrong caches repopulates them from on disk files", async function () {
        // create some data
        const path = nodePath.resolve("./files/" + uuid());
        let inv = new LocalInventoryClient(path);
        await inv.populate();
        assert(inv._areFileCachesCurrent());
        const dq = DQ.mint(14, 1);
        const twist = dq.buildTwist().twist();
        inv.put(twist.getAtoms());
        inv.writeCachesToDisk()

        // Break the cache
        let brokenFileCache = _getJSONFile(`${path}/filesCache.json`)
        brokenFileCache[twist.hash.toString()].hash = `41${"0".repeat(64)}`
        fs.writeFileSync(
            `${path}/filesCache.json`,
            JSON.stringify(brokenFileCache)
        );

        // Make new inv, run populate, make sure files / twistIdx are
        // correctly rebuilt
        const inv2 = new LocalInventoryClient(path);
        assert(!inv2._areFileCachesCurrent());
        await inv2.populate();
        assert(inv2._areFileCachesCurrent());

        assert.deepEqual(
            JSON.parse(JSON.stringify(Array.from(inv2.files.entries()))),
            [[twist.hash.toString(), { hash: twist.hash.toString(), n: 1 }]]
        );
        assert.deepEqual(
            JSON.parse(JSON.stringify(Array.from(inv2.twistIdx.entries()))),
            [[twist.hash.toString(), twist.hash.toString()]]
        );
    });

    it("popluating LocalInventoryClient with missing caches repopulates them from on disk files", async function () {
        // create some data
        const path = nodePath.resolve("./files/" + uuid());
        let inv = new LocalInventoryClient(path);
        assert(inv._areFileCachesCurrent());
        const dq = DQ.mint(14, 1);
        const twist = dq.buildTwist().twist();
        inv.put(twist.getAtoms());

        // NB no populate / writeCachesToDisk call here
        // Files exist on disk, but weren't added to the inventory and
        // weren't cached
        assert(!fs.existsSync(`${path}/filesCache.json`));
        assert(!fs.existsSync(`${path}/twistIdxCache.json`));

        // Make new inv, run populate, make sure files / twistIdx are
        // correctly rebuilt
        const inv2 = new LocalInventoryClient(path);
        assert(!inv2._areFileCachesCurrent());
        await inv2.populate();
        assert(inv2._areFileCachesCurrent());

        assert.deepEqual(
            JSON.parse(JSON.stringify(Array.from(inv2.files.entries()))),
            [[twist.hash.toString(), { hash: twist.hash.toString(), n: 1 }]]
        );
        assert.deepEqual(
            JSON.parse(JSON.stringify(Array.from(inv2.twistIdx.entries()))),
            [[twist.hash.toString(), twist.hash.toString()]]
        );
    });
});
