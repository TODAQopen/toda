import assert from 'assert';
import { DQCache } from '../../src/client/dq_cache.js';
import { Hash } from '../../src/core/hash.js';
import { DQ } from '../../src/abject/quantity.js';
import { TodaClient } from '../../src/client/client.js';
import { LocalInventoryClient } from '../../src/client/inventory.js';
import { Abject } from '../../src/abject/abject.js';
import { v4 as uuid } from 'uuid';
import fs from 'fs-extra';

describe("Load from disk", async function() {
    it("Properly loads a valid cache from disk", async function() {
        const cache = new DQCache("./test/client/dq_cache_dummies/sampleCache.json");
        const h0 = Hash.fromHex("416ef975f0c646daa44bec0469384436ccc6cd459ac40562bd676d568187625b67");
        const h1 = Hash.fromHex("41cffc535f9e57097584e8aa213013932487b1cc74e1f7d1b289fef88b9a1ac698");
        const h2 = Hash.fromHex("419491d887eff0cda77411e3fa2408607f60b395785abe623394f9f6cbfa101cd3");
        const root0 = Hash.fromHex("41c2ca3b2cea20d8426a324a0e4c8cf59522c7cb8fa6bf12ab46925a84e2d2ca46");
        const root1 = Hash.fromHex("414a0347b5d47a2d5f841f98a31a1df58a6e9ce5ba81dd898463424a711b6fc4a9");

        assert.equal(cache.listAll().length, 3);

        assert.equal(cache.getQuantity(h0), 40);
        assert.equal(cache.getDisplay(h0), 4.0);
        assert.ok(root0.equals(cache.getRootId(h0)));

        assert.equal(cache.getQuantity(h1), 45);
        assert.equal(cache.getDisplay(h1), 0.45);
        assert.ok(root1.equals(cache.getRootId(h1)));

        assert.equal(cache.getQuantity(h2), 3);
        assert.equal(cache.getDisplay(h2), 0.03);
        assert.ok(root1.equals(cache.getRootId(h2)));
    });

    it("Can properly load a new (ie, no json file) cache", async function() {
        const path = `./test/client/dq_cache_dummies/${uuid()}.json`;
        try {
            let cache = new DQCache(path);
            assert.equal(cache.listAll().length, 0);
        } finally {
            fs.removeSync(path);
        }
    });
});

describe("Save to disk", async function() {
    it("Properly saves a cache to disk", async function() {
        const path = `./test/client/dq_cache_dummies/${uuid()}.json`;
        try {
            let cache = new DQCache(path);
            const h0 = Hash.fromHex("41bec0469384436ccc6cd46ef975f0c646daa4459ac40562bd676d568187625b67");
            const h1 = Hash.fromHex("418aa213013932487b1cc74e1f7d1bcffc535f9e57097584e289fef88b9a1ac698");
            const h2 = Hash.fromHex("4177411e3fa2408607f60b9491d887eff0cda395785abe623394f9f6cbfa101cd3");
            const root0 = Hash.fromHex("41ea20d8426a324a0e4c8cf59c2ca3b2c522c7cb8fa6bf12ab46925a84e2d2ca46");
            const root1 = Hash.fromHex("415d47a2d5f841f98a31a4a0347b1df58a6e9ce5ba81dd898463424a711b6fc4a9");
            const poptop0 = Hash.fromHex("418426a352c2ca3b2cea20d2c7925a84e2d2ca46cb8fa624a0e4c8cf59bf12ab46");
            const poptop1 = Hash.fromHex("41a31a1df5847b5d47a2d5f841f9898463424a711b6fc4a9a6e9ce5ba81dd84a03");

            // monkey patch the cache
            const dummy = {};
            dummy[h0.toString()] = {rootId: root0, quantity: 80, displayPrecision: 0, 
                                    poptop: poptop0};
            dummy[h1.toString()] = {rootId: root1, quantity: 91, displayPrecision: 2,
                                    poptop: poptop1};
            dummy[h2.toString()] = {rootId: root1, quantity: 300, displayPrecision: 2,
                                    poptop: poptop1};
            cache.cache = dummy;

            cache._saveToDisk();

            // Reload from disk
            cache = new DQCache(path);

            const list = cache.listAll();
            assert.equal(list.length, 3);

            assert.equal(cache.getQuantity(h0), 80);
            assert.equal(cache.getDisplay(h0), 80);
            assert.ok(root0.equals(cache.getRootId(h0)));

            assert.equal(cache.getQuantity(h1), 91);
            assert.equal(cache.getDisplay(h1), 0.91);
            assert.ok(root1.equals(cache.getRootId(h1)));

            assert.equal(cache.getQuantity(h2), 300);
            assert.equal(cache.getDisplay(h2), 3);
            assert.ok(root1.equals(cache.getRootId(h2)));
        } finally {
            fs.removeSync(path);
        }
    });
});

describe("Remove", async function() {
    it("Properly removes the hash + saves to disk", async function() {
        const path = `./test/client/dq_cache_dummies/${uuid()}.json`;
        try {
            let cache = new DQCache(path);
            const h0 = Hash.fromHex("41bec0469384436ccc6cd46ef975f0c646daa4459ac40562bd676d568187625b67");
            const h1 = Hash.fromHex("418aa213013932487b1cc74e1f7d1bcffc535f9e57097584e289fef88b9a1ac698");
            const h2 = Hash.fromHex("4177411e3fa2408607f60b9491d887eff0cda395785abe623394f9f6cbfa101cd3");
            const root0 = Hash.fromHex("41ea20d8426a324a0e4c8cf59c2ca3b2c522c7cb8fa6bf12ab46925a84e2d2ca46");
            const root1 = Hash.fromHex("415d47a2d5f841f98a31a4a0347b1df58a6e9ce5ba81dd898463424a711b6fc4a9");
            const poptop0 = Hash.fromHex("418426a352c2ca3b2cea20d2c7925a84e2d2ca46cb8fa624a0e4c8cf59bf12ab46");
            const poptop1 = Hash.fromHex("41a31a1df5847b5d47a2d5f841f9898463424a711b6fc4a9a6e9ce5ba81dd84a03");

            // monkey patch the cache
            const dummy = {};
            dummy[h0.toString()] = {rootId: root0, quantity: 80, displayPrecision: 0,
                                    poptop: poptop0};
            dummy[h1.toString()] = {rootId: root1, quantity: 91, displayPrecision: 2,
                                    poptop: poptop1};
            dummy[h2.toString()] = {rootId: root1, quantity: 300, displayPrecision: 2,
                                    poptop: poptop1};
            cache.cache = dummy;

            assert.equal(cache.getQuantity(h1), 91);
            cache.remove(h1);
            assert.equal(cache.getQuantity(h1), null);

            // Reload from disk
            cache = new DQCache(path);

            const list = cache.listAll();
            assert.equal(list.length, 2);

            assert.equal(cache.getQuantity(h0), 80);
            assert.equal(cache.getDisplay(h0), 80);
            assert.ok(root0.equals(cache.getRootId(h0)));

            assert.equal(cache.getQuantity(h2), 300);
            assert.equal(cache.getDisplay(h2), 3);
            assert.ok(root1.equals(cache.getRootId(h2)));
        } finally {
            fs.removeSync(path);
        }
    });
});

describe("Add", async function() {
    it("Properly adds the dq + saves to disk", async function() {
        const path = `./test/client/dq_cache_dummies/${uuid()}.json`;
        try {
            let inv = new LocalInventoryClient("./files/" + uuid());
            let toda = new TodaClient(inv, "http://localhost:8000");
            await toda.populateInventory();
            toda._getSalt = () => new Uint8Array(new TextEncoder()
                                                    .encode("I am salty!"));
            let {twist, root} = await toda.mint(43, 1);
            let dq = Abject.fromTwist(twist);
            let [delegate, delegator] = await toda.delegateValue(dq, 3.4);

            delegate = Abject.fromTwist(delegate);
            delegator = Abject.fromTwist(delegator);

            let cache = new DQCache(path);

            cache.add(delegate);
            cache.add(delegator);

            assert.equal(cache.listAll().length, 2);

            assert.equal(cache.getQuantity(delegate.getHash()), 34);
            assert.equal(cache.getDisplay(delegate.getHash()), 3.4);
            assert.ok(root.equals(cache.getRootId(delegate.getHash())));

            assert.equal(cache.getQuantity(delegator.getHash()), 9);
            assert.equal(cache.getDisplay(delegator.getHash()), 0.9);
            assert.ok(root.equals(cache.getRootId(delegator.getHash())));

            // Reload from disk
            cache = new DQCache(path);

            assert.equal(cache.listAll().length, 2);

            assert.equal(cache.getQuantity(delegate.getHash()), 34);
            assert.equal(cache.getDisplay(delegate.getHash()), 3.4);
            assert.ok(root.equals(cache.getRootId(delegate.getHash())));

            assert.equal(cache.getQuantity(delegator.getHash()), 9);
            assert.equal(cache.getDisplay(delegator.getHash()), 0.9);
            assert.ok(root.equals(cache.getRootId(delegator.getHash())));
        } finally {
            fs.removeSync(path);
        }
    });
});

describe("Clear", async function() {
    it("Properly clears everything + saves to disk", async function() {
        const path = `./test/client/dq_cache_dummies/${uuid()}.json`;
        try {
            let cache = new DQCache(path);
            const h0 = Hash.fromHex("41bec0469384436ccc6cd46ef975f0c646daa4459ac40562bd676d568187625b67");
            const h1 = Hash.fromHex("418aa213013932487b1cc74e1f7d1bcffc535f9e57097584e289fef88b9a1ac698");
            const h2 = Hash.fromHex("4177411e3fa2408607f60b9491d887eff0cda395785abe623394f9f6cbfa101cd3");
            const root0 = Hash.fromHex("41ea20d8426a324a0e4c8cf59c2ca3b2c522c7cb8fa6bf12ab46925a84e2d2ca46");
            const root1 = Hash.fromHex("415d47a2d5f841f98a31a4a0347b1df58a6e9ce5ba81dd898463424a711b6fc4a9");

            // monkey patch the cache
            const dummy = {};
            dummy[h0.toString()] = {rootId: root0, quantity: 80, displayPrecision: 0};
            dummy[h1.toString()] = {rootId: root1, quantity: 91, displayPrecision: 2};
            dummy[h2.toString()] = {rootId: root1, quantity: 300, displayPrecision: 2};
            cache.cache = dummy;
            
            // Sanity
            assert.equal(cache.listAll().length, 3);

            cache._saveToDisk();
            cache.clear();

            assert.equal(cache.listAll().length, 0);

            cache = new DQCache(path);

            assert.equal(cache.listAll().length, 0);
        } finally {
            fs.removeSync(path);
        }
    });
});

describe("Balances", async function() {
    it("Balances as expected for multiple files", async function() {
        const cache = new DQCache("./test/client/dq_cache_dummies/sampleCache.json");
        const h0 = Hash.fromHex("416ef975f0c646daa44bec0469384436ccc6cd459ac40562bd676d568187625b67");
        const h1 = Hash.fromHex("41cffc535f9e57097584e8aa213013932487b1cc74e1f7d1b289fef88b9a1ac698");
        const h2 = Hash.fromHex("419491d887eff0cda77411e3fa2408607f60b395785abe623394f9f6cbfa101cd3");
        const root1 = Hash.fromHex("414a0347b5d47a2d5f841f98a31a1df58a6e9ce5ba81dd898463424a711b6fc4a9");
        const poptop1 = Hash.fromHex("41a31a1df5847b5d47a2d5f841f9898463424a711b6fc4a9a6e9ce5ba81dd84a03");

        const expectedQuantities = {};
        expectedQuantities[h1] = 45;
        expectedQuantities[h2] = 3;
        assert.deepEqual(cache.getBalance(root1),
                         {displayPrecision: 2,
                          totalQuantity: 48,
                          totalDisplay: 0.48,
                          poptop: poptop1,
                          fileQuantities: expectedQuantities});
    });

    it("Balances as expected for non-existant root id", async function() {
        const cache = new DQCache("./test/client/dq_cache_dummies/sampleCache.json");
        const fakeRoot = Hash.fromHex("41a5ba81dd898463424a0347b5d474a711b6f2d5f841f98a31a1df58a6e9cec4a9");

        assert.equal(cache.getBalance(fakeRoot), null);
    });
});

describe("Accessors", async function() {
    it("Accessors for specific files + specific root ids work as expected", async function() {
        const cache = new DQCache("./test/client/dq_cache_dummies/sampleCache.json");
        const h0 = Hash.fromHex("416ef975f0c646daa44bec0469384436ccc6cd459ac40562bd676d568187625b67");
        const h1 = Hash.fromHex("41cffc535f9e57097584e8aa213013932487b1cc74e1f7d1b289fef88b9a1ac698");
        const h2 = Hash.fromHex("419491d887eff0cda77411e3fa2408607f60b395785abe623394f9f6cbfa101cd3");
        const root0 = Hash.fromHex("41c2ca3b2cea20d8426a324a0e4c8cf59522c7cb8fa6bf12ab46925a84e2d2ca46");
        const root1 = Hash.fromHex("414a0347b5d47a2d5f841f98a31a1df58a6e9ce5ba81dd898463424a711b6fc4a9");
        const poptop0 = Hash.fromHex("418426a352c2ca3b2cea20d2c7925a84e2d2ca46cb8fa624a0e4c8cf59bf12ab46");
        const poptop1 = Hash.fromHex("41a31a1df5847b5d47a2d5f841f9898463424a711b6fc4a9a6e9ce5ba81dd84a03");

        // for h0
        assert.equal(cache.getQuantity(h0), 40);
        assert.equal(cache.getDisplay(h0), 4.0);
        assert.ok(cache.getRootId(h0).equals(root0));

        // for h1
        assert.equal(cache.getQuantity(h1), 45);
        assert.equal(cache.getDisplay(h1), 0.45);
        assert.ok(cache.getRootId(h1).equals(root1));

        // for h2
        assert.equal(cache.getQuantity(h2), 3);
        assert.equal(cache.getDisplay(h2), 0.03);
        assert.ok(cache.getRootId(h2).equals(root1));

        // for root0
        assert.equal(cache.getDisplayPrecisionForRootId(root0), 1);
        assert.ok(cache.getPoptopForRootId(root0).equals(poptop0));

        // for root1
        assert.equal(cache.getDisplayPrecisionForRootId(root1), 2);
        assert.ok(cache.getPoptopForRootId(root1).equals(poptop1));
    });
});