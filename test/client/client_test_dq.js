import assert from "assert";
import { Abject } from "../../src/abject/abject.js";
import { Hash } from "../../src/core/hash.js";
import { TodaClient } from "../../src/client/client.js";
import { LocalInventoryClient } from "../../src/client/inventory.js";
import { v4 as uuid } from "uuid";
import { createLine, initRelay, mint } from "./util.js";
import { InsufficientQuantity, InvalidDisplayPrecision, InvalidQuantity }
    from "../../src/abject/quantity.js";
import { SECP256r1 } from "../../src/client/secp256r1.js";

describe("getQuantity", async () => {
    it("getQuantity for DQ", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        await toda.populateInventory();
        toda._getSalt = () => new Uint8Array(new TextEncoder()
                                                .encode("I am salty!"));
        const {twist, root} = await mint(toda, 43, 1);
        const dq = Abject.fromTwist(twist);
        assert.equal(43, toda.getQuantity(dq));

        // properly cached
        assert.equal(43, toda.getQuantity(dq));
    });

    it("getCombinedQuantities for DQs", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        await toda.populateInventory();
        toda._getSalt = () => new Uint8Array(new TextEncoder()
                                                .encode("I am salty!"));
        let {twist} = await mint(toda, 43, 1);
        let dq = Abject.fromTwist(twist);

        let [delegate, delegator] = await toda.delegateValue(dq, 3.4);

        assert.equal(34, toda.getQuantity(Abject.fromTwist(delegate)));
        assert.equal(9, toda.getQuantity(Abject.fromTwist(delegator)));
        assert.equal(43, toda.getCombinedQuantity([Abject.fromTwist(delegate),
                                                   Abject.fromTwist(delegator)]));
    });
});

describe("getBalance", async () => {
    it("Unknown type hash", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        await toda.populateInventory();
        const root = Hash.fromHex("41896f0dcf6ac269b867186c16db10cc6db093f1b8064cbf44a6d6e9e7f2921bd5");
        let result = toda.getBalance(root);
        assert.deepEqual({balance: 0,
                          quantity: 0,
                          type: root.toString(),
                          files: [],
                          recalculating: false,
                          poptop: null,
                          displayPrecision: null,
                          fileQuantities: {}},
                         result);
    });

    it("Simple", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        await toda.populateInventory();
        toda._getSalt = () => new Uint8Array(new TextEncoder()
                                                .encode("I am salty!"));
        let {twist, root} = await mint(toda, 43, 1);
        let dq = Abject.fromTwist(twist);
        let [delegate, delegator] = await toda.delegateValue(dq, 3.4);

        let result = toda.getBalance(root);

        const expectedQuantities = {};
        expectedQuantities[delegator.getHash()] = 9;
        expectedQuantities[delegate.getHash()] = 34;
        assert.deepEqual({balance: 4.3,
                          quantity: 43,
                          type: root.toString(),
                          files: [delegator.getHash().toString(),
                                  delegate.getHash().toString()],
                          recalculating: false,
                          poptop: null,
                          displayPrecision: 1,
                          fileQuantities: expectedQuantities},
                         result);
    });

    it("Uncontrolled", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        await toda.populateInventory();
        toda._getSalt = () => new Uint8Array(new TextEncoder()
                                                .encode("I am salty!"));
        let {twist, root} = await mint(toda, 43, 1);
        let dq = Abject.fromTwist(twist);
        let [delegate, delegator] = await toda.delegateValue(dq, 3.4);

        // Delegator is no longer controlled by address
        await toda.append(delegator,
                          Hash.fromHex("41896f0dcf6ac269b867186c16db10cc6db093f1b8064cbf44a6d6e9e7f2921bd5"));

        let result = toda.getBalance(root);
        const expectedQuantities = {};
        expectedQuantities[delegate.getHash()] = 34;

        assert.deepEqual({balance: 3.4,
                          quantity: 34,
                          type: root.toString(),
                          files: [delegate.getHash().toString()],
                          fileQuantities: expectedQuantities,
                          poptop: null,
                          displayPrecision: 1,
                          recalculating: false},
                         result);
    });
});

describe("delegateValue", async () => {
    it("Simple", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        await toda.populateInventory();
        toda._getSalt = () => new Uint8Array(new TextEncoder()
                                                .encode("I am salty!"));
        let {twist, root} = await mint(toda, 43, 1);
        let dq = Abject.fromTwist(twist);
        let [delegate, delegator] = await toda.delegateValue(dq, 3.4);
        assert.ok(Abject.fromTwist(delegate)
                        .delegateOf()
                        .getHash()
                        .equals(delegator.getHash()));
        assert.equal(Abject.fromTwist(delegate).quantity, 34);
        assert.equal(Abject.fromTwist(delegator).quantity, 9);
        assert.ok(Abject.fromTwist(delegate).rootId().equals(root));
        assert.ok(Abject.fromTwist(delegator).rootId().equals(root));
    });

    it("Nested", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        await toda.populateInventory();
        toda._getSalt = () => new Uint8Array(new TextEncoder()
                                                .encode("I am salty!"));
        let {twist, root} = await mint(toda, 43, 1);
        let dq = Abject.fromTwist(twist);
        let [delegate, delegator] = await toda.delegateValue(dq, 3.4);
        dq = Abject.fromTwist(delegate);
        [delegate, delegator] = await toda.delegateValue(dq, 2.4);
        assert.ok(Abject.fromTwist(delegate)
                        .delegateOf()
                        .getHash()
                        .equals(delegator.getHash()));
        assert.equal(Abject.fromTwist(delegate).quantity, 24);
        assert.equal(Abject.fromTwist(delegator).quantity, 10);
        assert.ok(Abject.fromTwist(delegate).rootId().equals(root));
        assert.ok(Abject.fromTwist(delegator).rootId().equals(root));
    });

    it("Client cannot satisfy DQ", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        await toda.populateInventory();
        let req = await SECP256r1.generate();
        toda.addSatisfier(req);
        toda._getSalt = () => new Uint8Array(new TextEncoder().encode("I am salty!"));
        let localLine = await toda.create(null, req);
        await toda.append(localLine, null, req);

        let {twist} = await mint(toda, 43, 1, localLine.getHash());
        let dq = Abject.fromTwist(twist);

        // New client does not have satisfier
        inv = new LocalInventoryClient("./files/" + uuid());
        toda = new TodaClient(inv, "http://localhost:8000");
        await toda.populateInventory();
        await assert.rejects(toda.delegateValue(dq, 2.2),
                             {
                                name: "CannotSatisfyError"
                             });
    });


    it("Not enough qty", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        await toda.populateInventory();
        toda._getSalt = () => new Uint8Array(new TextEncoder()
                                                .encode("I am salty!"));
        let {twist} = await mint(toda, 43, 1);
        let dq = Abject.fromTwist(twist);
        await assert.rejects(toda.delegateValue(dq, 8.2),
                                                InsufficientQuantity);
    });

    it("NaN", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        await toda.populateInventory();
        toda._getSalt = () => new Uint8Array(new TextEncoder()
                                                .encode("I am salty!"));
        let {twist} = await mint(toda, 43, 1);
        let dq = Abject.fromTwist(twist);
        await assert.rejects(toda.delegateValue(dq, "EIGHTEEN"));
    });

    it("Delegate value updates its tether", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        await toda.populateInventory();
        toda._getSalt = () => new Uint8Array(new TextEncoder()
                                                .encode("I am salty!"));

        let relayTwist0 = await toda.create();
        let relayTwist1 = await toda.append(relayTwist0);

        let {twist} = await mint(toda, 43, 1, relayTwist0.getHash());
        twist.addAtoms(relayTwist1.getAtoms());
        let dq = Abject.fromTwist(twist);
        let [delegate, delegator] = await toda.delegateValue(dq, 3.4);
        assert.ok(twist.getTetherHash().equals(relayTwist0.getHash()));
        // Delegate + delegator now point to a newer twist
        assert.ok(delegate.tether().findPrevious(relayTwist1.getHash()));
        assert.ok(delegator.tether().findPrevious(relayTwist1.getHash()));
    });
});

describe("Transfer tests; simple", async () => {
    it("Exact", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        await toda.populateInventory();
        let destHash = Hash.fromHex("41896f0dcf6ac269b867186c16db10cc6db093f1b8064cbf44a6d6e9e7f2921bd5");
        toda._getSalt = () => new Uint8Array(new TextEncoder()
                                                .encode("I am salty!"));
        let {root} = await mint(toda, 43, 1);
        let newTwists = await toda.transfer({amount: 4.3,
                                             typeHash: root,
                                             destHash});
        assert.equal(newTwists.length, 1);
        let newTwist = newTwists[0];
        assert.ok(newTwist.getTetherHash().equals(destHash));
        assert.equal(toda.getBalance(root).balance, 0);
        assert.deepEqual(newTwists.map(t => Abject.fromTwist(t).quantity),
                         [43]);
    });

    it("Excess", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        await toda.populateInventory();
        let destHash = Hash.fromHex("41896f0dcf6ac269b867186c16db10cc6db093f1b8064cbf44a6d6e9e7f2921bd5");
        toda._getSalt = () => new Uint8Array(new TextEncoder()
                                            .encode("I am salty!"));
        let {root} = await mint(toda, 43, 1);
        let newTwists = await toda.transfer({amount: 3.1,
                                             typeHash: root,
                                             destHash});
        assert.equal(newTwists.length, 1);
        let newTwist = newTwists[0];
        assert.ok(newTwist.getTetherHash().equals(destHash));
        assert.equal((await toda.getBalance(root)).balance, 1.2);
        assert.deepEqual(newTwists.map(t => Abject.fromTwist(t).quantity),
                         [31]);
    });

    it("Multiple exact change", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        await toda.populateInventory();
        let destHash = Hash.fromHex("41896f0dcf6ac269b867186c16db10cc6db093f1b8064cbf44a6d6e9e7f2921bd5");
        toda._getSalt = () => new Uint8Array(new TextEncoder()
                                            .encode("I am salty!"));
        let {twist, root} = await mint(toda, 45, 1);
        let [delegate] =
            await toda.delegateValue(Abject.fromTwist(twist), 3);
        await toda.delegateValue(Abject.fromTwist(delegate), 1.5);
        // Now there are three bills: 1.5, 1.5, 1.5
        let newTwists = await (await toda.transfer({amount: 3,
                                                    typeHash: root,
                                                    destHash}));
        assert.equal(newTwists.length, 2);
        assert.equal((await toda.getBalance(root)).balance, 1.5);
        assert.deepEqual(newTwists.map(t => Abject.fromTwist(t).quantity),
                     [15, 15]);
    });

    it("Multiple change", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        await toda.populateInventory();
        let destHash = Hash.fromHex("41896f0dcf6ac269b867186c16db10cc6db093f1b8064cbf44a6d6e9e7f2921bd5");
        toda._getSalt = () => new Uint8Array(new TextEncoder()
                                                .encode("I am salty!"));
        let {twist, root} = await mint(toda, 43, 1);
        // Now there are two bills: 2.6 and 1.7
        await toda.delegateValue(Abject.fromTwist(twist), 2.6);
        let newTwists = await (await toda.transfer({amount: 3.1,
                                                    typeHash: root,
                                                    destHash}));
        assert.equal(newTwists.length, 2);
        assert.equal((await toda.getBalance(root)).balance, 1.2);
        assert.equal(newTwists.map(t => Abject.fromTwist(t).quantity)
                              .reduce((x, y) => x + y, 0),
                     31);
    });
});

describe("Transfer tests; comprehensive", async function() {
    beforeEach(async function() {
        const { toda, server, twists, req } =
            await initRelay(8090, null, null, 5);
        this.relayReq = req;
        this.relayClient = toda;
        this.relayServer = server;
        this.initRelayTwists = twists;
    });

    afterEach(async function() {
        await this.relayServer.stop();
    });

    it("Alice => Bob, same poptop", async function() {
        const { toda: alice } =
            await createLine(this.initRelayTwists[2].getHash());
        const { toda: bob, hash: bobHash } =
            await createLine(this.initRelayTwists[2].getHash());
        const dq = (await mint(alice, 143, 1)).root;

        let transferedTwists = await alice.transfer({amount: 9.2,
                                                     destHash: bobHash,
                                                     typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            bob.inv.put(t.getAtoms());
        }

        assert.equal((await alice.getBalance(dq, true)).balance, 5.1);
        assert.equal((await bob.getBalance(dq, true)).balance, 9.2);
    });

    it("Alice => Bob => Charlie, same poptop", async function() {
        const { toda: alice } =
            await createLine(this.initRelayTwists[2].getHash());
        const { toda: bob, hash: bobHash } =
            await createLine(this.initRelayTwists[2].getHash());
        const { toda: charlie, hash: charlieHash } =
            await createLine(this.initRelayTwists[2].getHash());
        const dq = (await mint(alice, 143, 1)).root;

        let transferedTwists = await alice.transfer({amount: 9.2,
                                                     destHash: bobHash,
                                                     typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            bob.inv.put(t.getAtoms());
        }

        transferedTwists = await bob.transfer({amount: 6.2,
                                               destHash: charlieHash,
                                               typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            charlie.inv.put(t.getAtoms());
        }

        assert.equal((await alice.getBalance(dq, true)).balance, 5.1);
        assert.equal((await bob.getBalance(dq, true)).balance, 3);
        assert.equal((await charlie.getBalance(dq, true)).balance, 6.2);
    });

    it("Alice => Bob => Alice, same poptop", async function() {
        const { toda: alice, hash: aliceHash } =
            await createLine(this.initRelayTwists[2].getHash());
        const { toda: bob, hash: bobHash } =
            await createLine(this.initRelayTwists[2].getHash());
        const dq = (await mint(alice, 143, 1)).root;

        let transferedTwists = await alice.transfer({amount: 9.2,
                                                     destHash: bobHash,
                                                     typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            bob.inv.put(t.getAtoms());
        }

        transferedTwists = await bob.transfer({amount: 6.2,
                                               destHash: aliceHash,
                                               typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            alice.inv.put(t.getAtoms());
        }

        assert.equal((await alice.getBalance(dq, true)).balance, 11.3);
        assert.equal((await bob.getBalance(dq, true)).balance, 3);
    });

    it("Alice => Bob => Alice, Alice earlier poptop", async function() {
        const { toda: alice, hash: aliceHash } =
            await createLine(this.initRelayTwists[0].getHash());
        const { toda: bob, hash: bobHash } =
            await createLine(this.initRelayTwists[2].getHash());
        const dq = (await mint(alice, 143, 1)).root;

        let transferedTwists = await alice.transfer({amount: 9.2,
                                                     destHash: bobHash,
                                                     typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            bob.inv.put(t.getAtoms());
        }

        transferedTwists = await bob.transfer({amount: 6.2,
                                               destHash: aliceHash,
                                               typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            alice.inv.put(t.getAtoms());
        }

        assert.equal((await alice.getBalance(dq, true)).balance, 11.3);
        assert.equal((await bob.getBalance(dq, true)).balance, 3);
    });

    it("Alice => Bob => Alice, Bob earlier poptop", async function() {
        const { toda: alice, hash: aliceHash } =
            await createLine(this.initRelayTwists[2].getHash());
        const { toda: bob, hash: bobHash } =
            await createLine(this.initRelayTwists[0].getHash());
        const dq = (await mint(alice, 143, 1)).root;

        let transferedTwists = await alice.transfer({amount: 9.2,
                                                     destHash: bobHash,
                                                     typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            bob.inv.put(t.getAtoms());
        }

        transferedTwists = await bob.transfer({amount: 6.2,
                                               destHash: aliceHash,
                                               typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            alice.inv.put(t.getAtoms());
        }

        assert.equal((await alice.getBalance(dq, true)).balance, 11.3);
        assert.equal((await bob.getBalance(dq, true)).balance, 3);
    });

    it("Alice => Bob => Charlie, Bob earlier poptop, Charlie even earlier", async function() {
        const { toda: alice } =
            await createLine(this.initRelayTwists[4].getHash());
        const { toda: bob, hash: bobHash } =
            await createLine(this.initRelayTwists[2].getHash());
        const { toda: charlie, hash: charlieHash } =
            await createLine(this.initRelayTwists[0].getHash());
        const dq = (await mint(alice, 143, 1)).root;

        let transferedTwists = await alice.transfer({amount: 9.2,
                                                     destHash: bobHash,
                                                     typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            bob.inv.put(t.getAtoms());
        }

        transferedTwists = await bob.transfer({amount: 6.2,
                                               destHash: charlieHash,
                                               typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            charlie.inv.put(t.getAtoms());
        }

        assert.equal((await alice.getBalance(dq, true)).balance, 5.1);
        assert.equal((await bob.getBalance(dq, true)).balance, 3);
        assert.equal((await charlie.getBalance(dq, true)).balance, 6.2);
    });

    it("Alice => Bob => Alice, DQ has earlier poptop than Bob", async function() {
        const { toda: alice, hash: aliceHash } =
            await createLine(this.initRelayTwists[0].getHash());
        const { toda: bob, hash: bobHash } =
            await createLine(this.initRelayTwists[2].getHash());
        const dq = (await mint(alice, 143, 1)).root;

        let transferedTwists = await alice.transfer({amount: 9.2,
                                                     destHash: bobHash,
                                                     typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            bob.inv.put(t.getAtoms());
        }

        transferedTwists = await bob.transfer({amount: 6.2,
                                               destHash: aliceHash,
                                               typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            alice.inv.put(t.getAtoms());
        }

        assert.equal((await alice.getBalance(dq, true)).balance, 11.3);
        assert.equal((await bob.getBalance(dq, true)).balance, 3);
    });

    it("Alice => Bob => Alice, DQ has earlier poptop than Bob, multiple files transferred", async function() {
        const { toda: alice, hash: aliceHash } =
            await createLine(this.initRelayTwists[0].getHash());
        const { toda: bob, hash: bobHash } =
            await createLine(this.initRelayTwists[2].getHash());
        const dq = (await mint(alice, 143, 1)).root;

        // force a split s.t. multiple files are sent in the next tx
        let transferedTwists = await alice.transfer({amount: 8,
                                                     destHash: aliceHash,
                                                     typeHash: dq});

        transferedTwists = await alice.transfer({amount: 9.2,
            destHash: bobHash,
            typeHash: dq});

        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            bob.inv.put(t.getAtoms());
        }

        transferedTwists = await bob.transfer({amount: 6.2,
                                               destHash: aliceHash,
                                               typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            alice.inv.put(t.getAtoms());
        }

        assert.equal((await alice.getBalance(dq, true)).balance, 11.3);
        assert.equal((await bob.getBalance(dq, true)).balance, 3);
    });

    it("Alice => Bob => Alice, DQ has earlier poptop than either", async function() {
        const { toda: alice, hash: aliceHash } =
            await createLine(this.initRelayTwists[2].getHash());
        const { toda: bob, hash: bobHash } =
            await createLine(this.initRelayTwists[2].getHash());
        const dq = (await mint(alice,
                               143,
                               1,
                               aliceHash,
                               this.initRelayTwists[0].getHash())).root;

        let transferedTwists = await alice.transfer({amount: 9.2,
                                                     destHash: bobHash,
                                                     typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            bob.inv.put(t.getAtoms());
        }

        transferedTwists = await bob.transfer({amount: 6.2,
                                               destHash: aliceHash,
                                               typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            alice.inv.put(t.getAtoms());
        }

        assert.equal((await alice.getBalance(dq, true)).balance, 11.3);
        assert.equal((await bob.getBalance(dq, true)).balance, 3);
    });

    it("Alice => Bob => Charlie, DQ has earlier poptop than all of them", async function() {
        const { toda: alice, hash: aliceHash } =
            await createLine(this.initRelayTwists[2].getHash());
        const { toda: bob, hash: bobHash } =
            await createLine(this.initRelayTwists[2].getHash());
        const { toda: charlie, hash: charlieHash } =
            await createLine(this.initRelayTwists[2].getHash());
        const dq = (await mint(alice,
                               143,
                               1,
                               aliceHash,
                               this.initRelayTwists[0].getHash())).root;

        let transferedTwists = await alice.transfer({amount: 9.2,
                                                     destHash: bobHash,
                                                     typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            bob.inv.put(t.getAtoms());
        }

        transferedTwists = await bob.transfer({amount: 6.2,
                                               destHash: charlieHash,
                                               typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            charlie.inv.put(t.getAtoms());
        }

        assert.equal((await alice.getBalance(dq, true)).balance, 5.1);
        assert.equal((await bob.getBalance(dq, true)).balance, 3);
        assert.equal((await charlie.getBalance(dq, true)).balance, 6.2);
    });

    it("Alice => Bob => Charlie, DQ has later poptop than all of them", async function() {
        const { toda: alice, hash: aliceHash } =
            await createLine(this.initRelayTwists[2].getHash());
        const { toda: bob, hash: bobHash } =
            await createLine(this.initRelayTwists[2].getHash());
        const { toda: charlie, hash: charlieHash } =
            await createLine(this.initRelayTwists[2].getHash());

        const recentTop =
            await this.relayClient.get(this.initRelayTwists[0].getHash());
        // create a more recent poptop
        const newTop = await this.relayClient.append(recentTop,
            null,
            this.relayReq);
        // make sure that new twist is available to the relay clients
        //  by making one more twist
        await this.relayClient.append(newTop,
            null,
            this.relayReq);

        const dq = (await mint(alice,
                               143,
                               1,
                               aliceHash,
                               newTop.getHash())).root;

        let transferedTwists = await alice.transfer({amount: 9.2,
                                                     destHash: bobHash,
                                                     typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            bob.inv.put(t.getAtoms());
        }

        transferedTwists = await bob.transfer({amount: 6.2,
                                               destHash: charlieHash,
                                               typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            charlie.inv.put(t.getAtoms());
        }

        assert.equal((await alice.getBalance(dq, true)).balance, 5.1);
        assert.equal((await bob.getBalance(dq, true)).balance, 3);
        assert.equal((await charlie.getBalance(dq, true)).balance, 6.2);
    });

    it("Alice => Bob, DQ cache contradiction", async function() {
        const { toda: alice } =
            await createLine(this.initRelayTwists[2].getHash());
        const { toda: bob, hash: bobHash } =
            await createLine(this.initRelayTwists[2].getHash());
        const dq = (await mint(alice, 143, 1)).root;

        alice.inv.dqCache.clear();
        //HACK: Would prefer not to have to reach into the DQ cache like this...
        alice.inv.dqCache.cache["4141896f0dcf6ac269b867186c16db10cc6db093f1b8064cbf44a6d6e9e7f2921bd5"]
            = {quantity: 400,
               displayPrecision: 1,
               poptop: null,
               rootId: dq};

        let transferedTwists = await alice.transfer({amount: 9.2,
                                                     destHash: bobHash,
                                                     typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            bob.inv.put(t.getAtoms());
        }

        assert.equal((await alice.getBalance(dq, true)).balance, 5.1);
        assert.equal((await bob.getBalance(dq, true)).balance, 9.2);
    });
});

describe("Transfer tests; comprehensive with multiple relays", async function() {
    beforeEach(async function() {
        const upper = await initRelay(8091, null, null, 5);
        const lower = await initRelay(8090, "http://localhost:8091",
                                      upper.twists[2].getHash(), 5);
        this.lowerRelay = lower;
        this.upperRelay = upper;
    });

    afterEach(async function() {
        await this.lowerRelay.server.stop();
        await this.upperRelay.server.stop();
    });

    it("Alice => Bob => Charlie, same poptop, multi layered poptop", async function() {
        const { toda: alice } =
            await createLine(this.lowerRelay.twists[2].getHash(),
                             this.upperRelay.twists[2].getHash());
        const { toda: bob, hash: bobHash } =
            await createLine(this.lowerRelay.twists[2].getHash(),
                             this.upperRelay.twists[2].getHash());
        const { toda: charlie, hash: charlieHash } =
            await createLine(this.lowerRelay.twists[2].getHash(),
                             this.upperRelay.twists[2].getHash());
        const dq = (await mint(alice, 143, 1)).root;

        let transferedTwists =  await alice.transfer({amount: 9.2,
                                                      destHash: bobHash,
                                                      typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            bob.inv.put(t.getAtoms());
        }

        transferedTwists = await bob.transfer({amount: 6.2,
                                               destHash: charlieHash,
                                               typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            charlie.inv.put(t.getAtoms());
        }

        assert.equal((await alice.getBalance(dq, true)).balance, 5.1);
        assert.equal((await bob.getBalance(dq, true)).balance, 3);
        assert.equal((await charlie.getBalance(dq, true)).balance, 6.2);
    });

    it("Alice => Bob => Charlie, same poptop, multi layered poptop",
    async function() {
        const { toda: alice } =
            await createLine(this.lowerRelay.twists[2].getHash(),
                             this.upperRelay.twists[2].getHash());
        const { toda: bob, hash: bobHash } =
            await createLine(this.lowerRelay.twists[2].getHash(),
                             this.upperRelay.twists[2].getHash());
        const { toda: charlie, hash: charlieHash } =
            await createLine(this.lowerRelay.twists[2].getHash(),
                             this.upperRelay.twists[2].getHash());
        const dq = (await mint(alice, 143, 1)).root;

        let transferedTwists = await alice.transfer({amount: 9.2,
                                                     destHash: bobHash,
                                                     typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            bob.inv.put(t.getAtoms());
        }

        transferedTwists = await bob.transfer({amount: 6.2,
                                               destHash: charlieHash,
                                               typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            charlie.inv.put(t.getAtoms());
        }

        assert.equal((await alice.getBalance(dq, true)).balance, 5.1);
        assert.equal((await bob.getBalance(dq, true)).balance, 3);
        assert.equal((await charlie.getBalance(dq, true)).balance, 6.2);
    });

    it("Alice => Bob => Charlie, multi layered poptop, DQ has a lower poptop than addresses", async function() {
        const { toda: alice, hash: aliceHash } =
            await createLine(this.lowerRelay.twists[2].getHash(),
                             this.upperRelay.twists[2].getHash());
        const { toda: bob, hash: bobHash } =
            await createLine(this.lowerRelay.twists[2].getHash(),
                             this.upperRelay.twists[2].getHash());
        const { toda: charlie, hash: charlieHash } =
            await createLine(this.lowerRelay.twists[2].getHash(),
                             this.upperRelay.twists[2].getHash());
        const dq = (await mint(alice,
                               143,
                               1,
                               aliceHash,
                               this.lowerRelay.twists[2].getHash())).root;

        let transferedTwists = await alice.transfer({amount: 9.2,
                                                     destHash: bobHash,
                                                     typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            bob.inv.put(t.getAtoms());
        }

        transferedTwists = await bob.transfer({amount: 6.2,
                                               destHash: charlieHash,
                                               typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            charlie.inv.put(t.getAtoms());
        }

        assert.equal((await alice.getBalance(dq, true)).balance, 5.1);
        assert.equal((await bob.getBalance(dq, true)).balance, 3);
        assert.equal((await charlie.getBalance(dq, true)).balance, 6.2);
    });

    it("Alice => Bob => Charlie, multi layered poptop, DQ has a higher poptop than addresses", async function() {
        const { toda: alice, hash: aliceHash } =
            await createLine(this.lowerRelay.twists[2].getHash());
        const { toda: bob, hash: bobHash } =
            await createLine(this.lowerRelay.twists[2].getHash());
        const { toda: charlie, hash: charlieHash } =
            await createLine(this.lowerRelay.twists[2].getHash());

        const dq = (await mint(alice,
                               143,
                               1,
                               aliceHash,
                               this.upperRelay.twists[0].getHash())).root;

        let transferedTwists = await alice.transfer({amount: 9.2,
                                                     destHash: bobHash,
                                                     typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            bob.inv.put(t.getAtoms());
        }

        transferedTwists = await bob.transfer({amount: 6.2,
                                               destHash: charlieHash,
                                               typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            charlie.inv.put(t.getAtoms());
        }

        assert.equal((await alice.getBalance(dq, true)).balance, 5.1);
        assert.equal((await bob.getBalance(dq, true)).balance, 3);
        assert.equal((await charlie.getBalance(dq, true)).balance, 6.2);
    });

    it("Alice => Bob => Charlie, DQ has earlier poptop, multi layered poptop", async function() {
        const { toda: alice, hash: aliceHash } =
            await createLine(this.lowerRelay.twists[2].getHash(),
                             this.upperRelay.twists[2].getHash());
        const { toda: bob, hash: bobHash } =
            await createLine(this.lowerRelay.twists[2].getHash(),
                             this.upperRelay.twists[2].getHash());
        const { toda: charlie, hash: charlieHash } =
            await createLine(this.lowerRelay.twists[2].getHash(),
                             this.upperRelay.twists[2].getHash());

        const dq = (await mint(alice,
                               143,
                               1,
                               aliceHash,
                               this.upperRelay.twists[0].getHash())).root;

        let transferedTwists = await alice.transfer({amount: 9.2,
                                                     destHash: bobHash,
                                                     typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            bob.inv.put(t.getAtoms());
        }

        transferedTwists = await bob.transfer({amount: 6.2,
                                               destHash: charlieHash,
                                               typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            charlie.inv.put(t.getAtoms());
        }

        assert.equal((await alice.getBalance(dq, true)).balance, 5.1);
        assert.equal((await bob.getBalance(dq, true)).balance, 3);
        assert.equal((await charlie.getBalance(dq, true)).balance, 6.2);
    });

    it("Alice => Bob => Charlie, DQ has newer poptop, multi layered poptop", async function() {
        const { toda: alice, hash: aliceHash } =
            await createLine(this.lowerRelay.twists[2].getHash(),
                             this.upperRelay.twists[2].getHash());
        const { toda: bob, hash: bobHash } =
            await createLine(this.lowerRelay.twists[2].getHash(),
                             this.upperRelay.twists[2].getHash());
        const { toda: charlie, hash: charlieHash } =
            await createLine(this.lowerRelay.twists[2].getHash(),
                             this.upperRelay.twists[2].getHash());

        const recentTop = await this.upperRelay
                                    .toda
                                    .get(this.upperRelay.twists[0].getHash());
        // create a more recent poptop
        const newTop = await this.upperRelay.toda.append(recentTop,
                                                         null,
                                                         this.upperRelay.req);
        // make sure that new twist is available to the relay clients
        //  by making one more twist
        await this.upperRelay.toda.append(newTop,
                                          null,
                                          this.upperRelay.req);

        const dq = (await mint(alice,
                               143,
                               1,
                               aliceHash,
                               newTop.getHash())).root;

        let transferedTwists = await alice.transfer({amount: 9.2,
                                                     destHash: bobHash,
                                                     typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            bob.inv.put(t.getAtoms());
        }

        transferedTwists = await bob.transfer({amount: 6.2,
                                               destHash: charlieHash,
                                               typeHash: dq});
        for (const t of transferedTwists) {
            await Abject.fromTwist(t).checkAllRigs();
            charlie.inv.put(t.getAtoms());
        }

        assert.equal((await alice.getBalance(dq, true)).balance, 5.1);
        assert.equal((await bob.getBalance(dq, true)).balance, 3);
        assert.equal((await charlie.getBalance(dq, true)).balance, 6.2);
    });
});

describe("Mint tests", async function () {
    it("As little as possible specified, a-okay", async function () {
        const { toda, hash } = await createLine();
        const { twist, root } = await toda.mint(1232);
        const abj = Abject.fromTwist(twist);
        assert.equal(abj.quantity, 1232);
        assert.equal(abj.displayPrecision, 0);
        assert.equal(abj.popTop(), null);
        assert.ok(root.equals(abj.rootId()));
        assert.ok(hash.equals(twist.getTetherHash()));
    });

    it("Multiple things specified, a-okay", async function () {
        const topline = await initRelay(8091, null, null, 5);
        try {
            const { toda, hash } = await createLine(
                topline.twists[2].getHash(),
                topline.twists[2].getHash(),
                "http://localhost:8091/files",
                "http://localhost:8091/hoist");
            const t0 = await toda.create(hash);
            const t1 = await toda.append(t0, hash);
            const { twist, root } = await toda.mint(1232,
                                                    1,
                                                    t1.getHash(),
                                                    topline.twists[2]
                                                           .getHash(),
                                                    "Hello!");
            const abj = Abject.fromTwist(twist);
            assert.equal(abj.quantity, 1232);
            assert.equal(abj.displayPrecision, 1);
            assert.ok(topline.twists[2].getHash().equals(abj.popTop()));
            assert.ok(root.equals(abj.rootId()));
            assert.ok(t1.getHash().equals(twist.getTetherHash()));
            assert.equal(abj.mintingInfo, "Hello!");
        } finally {
            await topline.server.stop();
        }
    });

    it("Quantity error", async function () {
        const { toda } = await createLine();
        await assert.rejects(toda.mint(123.2),
                             InvalidQuantity);
        await assert.rejects(toda.mint(0),
                             InvalidQuantity);
        await assert.rejects(toda.mint(null),
                             InvalidQuantity);
        await assert.rejects(toda.mint(-4),
                             InvalidQuantity);
        await assert.rejects(toda.mint("HELLO!"),
                             InvalidQuantity);
    });

    it("Display precision error", async function () {
        const { toda } = await createLine();
        await assert.rejects(toda.mint(123, 0.2),
                             InvalidDisplayPrecision);
        await assert.rejects(toda.mint(123, -2),
                             InvalidDisplayPrecision);
        await assert.rejects(toda.mint(123, 16),
                             InvalidDisplayPrecision);
        await assert.rejects(toda.mint(123, "HELLO!"),
                             InvalidDisplayPrecision);
    });
});
