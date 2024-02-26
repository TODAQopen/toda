import { LocalInventoryClient } from "../../src/client/inventory.js";
import { Hash } from "../../src/core/hash.js";
import { TwistBuilder } from "../../src/core/twist.js";

import assert from "assert";
import { v4 as uuid } from "uuid";
import fs from 'fs-extra';
import { uuidCargo } from "../util.js";

describe("Archive", async () => {
    it("Should properly archive file", async () => {
        const inv = new LocalInventoryClient("./files/" + uuid());
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

        // t0 + t1 now archived
        assert.ok(!fs.existsSync(inv_init.filePathForHash(t0.getHash())));
        assert.ok(!fs.existsSync(inv_init.filePathForHash(t1.getHash())));
        assert.ok(fs.existsSync(inv_init.filePathForHash(t2.getHash())));

        // sanity check that archive files exist as expected
        assert.ok(fs.existsSync(inv_init.archivePathForHash(t0.getHash())));
        assert.ok(fs.existsSync(inv_init.archivePathForHash(t1.getHash())));
        assert.ok(!fs.existsSync(inv_init.archivePathForHash(t2.getHash())));

        // inv still behaves as expected when asking for an archived file
        assert.ok(inv.get(t0.getHash()).focus.equals(t2.getHash()));
    });

    it("Archives old files during put()", async () => {
        const path = "./files/" + uuid();
        const inv = new LocalInventoryClient(path);
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
        assert.ok(inv.get(t0.getHash()).focus.equals(t2.getHash()));
    });
});

describe("Unowned file mechanism", async function() {
    it("Unown removes all references in this.files + this.twistIdx and move file", async function() {
        const path = "./files/" + uuid();
        const inv = new LocalInventoryClient(path);
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
        const t0 = (new TwistBuilder()).twist();
        const t1 = t0.createSuccessor().twist();
        inv.put(t1.getAtoms());
        inv.unown(Hash.fromHex("41574c7372f3f95e459caaf4267f670328e674d0becd4aca5354e7516fe43688c4"));
    });

    it("Can still get an unowned file", async function() {
        const path = "./files/" + uuid();
        const inv = new LocalInventoryClient(path);
        const t0 = (new TwistBuilder()).twist();
        const t1 = t0.createSuccessor().twist();

        inv.put(t1.getAtoms());
        inv.unown(t0.getHash());

        const atoms = inv.get(t1.getHash());
        assert.ok(atoms);
        assert.ok(atoms.focus.equals(t1.getHash()));
    });

    it("Can still get an unowned file (extra sanity: reinstantiate inv to rm all state)", async function() {
        const path = "./files/" + uuid();
        let inv = new LocalInventoryClient(path);
        const t0 = (new TwistBuilder()).twist();
        const t1 = t0.createSuccessor().twist();

        inv.put(t1.getAtoms());
        inv.unown(t1.getHash());

        inv = new LocalInventoryClient(path);

        const atoms = inv.get(t1.getHash());
        assert.ok(atoms);
        assert.ok(atoms.focus.equals(t1.getHash()));
    });

    it("Can still get an archived file (extra sanity: reinstantiate inv to rm all state)", async function() {
        const path = "./files/" + uuid();
        let inv = new LocalInventoryClient(path);
        const t0 = (new TwistBuilder()).twist();
        const t1 = t0.createSuccessor().twist();

        inv.put(t0.getAtoms());
        inv.put(t1.getAtoms());
        inv.unown(t1.getHash());

        inv = new LocalInventoryClient(path);

        const atoms = inv.get(t0.getHash());
        assert.ok(atoms);
        assert.ok(atoms.focus.equals(t0.getHash()));
    });
});