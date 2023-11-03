import { LocalInventoryClient } from "../../src/client/inventory.js";
import { Hash } from "../../src/core/hash.js";
import { TwistBuilder } from "../../src/core/twist.js";

import assert from "assert";
import { v4 as uuid } from "uuid";
import fs from 'fs-extra';

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