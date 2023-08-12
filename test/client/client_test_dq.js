import assert from "assert";
import { Abject } from "../../src/abject/abject.js";
import { DQ } from "../../src/abject/quantity.js";
import { ByteArray } from "../../src/core/byte-array.js";
import { Hash } from "../../src/core/hash.js";
import { SECP256r1 } from "../../src/client/secp256r1.js";
import { TodaClient } from "../../src/client/client.js";
import { LocalInventoryClient } from "../../src/client/inventory.js";
import { v4 as uuid } from "uuid";
import { P1String } from "../../src/abject/primitive.js";

async function mint(client, qty, precision, tether)
{
    let req = await SECP256r1.generate();
    let mintingInfo = new P1String(JSON.stringify({uuid: uuid()}));
    let abj = DQ.mint(qty, precision, mintingInfo);
    client.addSatisfier(req);
    return await client.finalizeTwist(abj.buildTwist(), tether, req);
}

describe("getQuantity", async () => {
    it("getQuantity for DQ", async () =>
    {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        toda._getSalt = () => new ByteArray(new TextEncoder().encode("I am salty!"));
        let twist = await mint(toda, 43, 1);
        let dq = Abject.fromTwist(twist);
        assert.equal(43, toda.getQuantity(dq));

        // properly cached
        assert.ok(toda.dq.quantities[dq.getHash()]);
        assert.equal(43, toda.getQuantity(dq));
    });

    it("getCombinedQuantities for DQs", async () =>
    {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        toda._getSalt = () => new ByteArray(new TextEncoder().encode("I am salty!"));
        let twist = await mint(toda, 43, 1, );
        let dq = Abject.fromTwist(twist);

        let [delegate, delegator] = await toda.delegateValue(dq, 3.4);

        assert.equal(34, toda.getQuantity(Abject.fromTwist(delegate)));
        assert.equal(9, toda.getQuantity(Abject.fromTwist(delegator)));
        assert.equal(43, toda.getCombinedQuantity([Abject.fromTwist(delegate),
                                                    Abject.fromTwist(delegator)]));
    });
});

describe("getBalance", async () => {
    it("Unknown type hash", async () =>
    {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        let result = await toda.getBalance(Hash.fromHex("41896f0dcf6ac269b867186c16db10cc6db093f1b8064cbf44a6d6e9e7f2921bd5"));
        assert.deepEqual({balance: 0,
                          quantity: 0,
                          type: "41896f0dcf6ac269b867186c16db10cc6db093f1b8064cbf44a6d6e9e7f2921bd5",
                          files: [],
                          recalculating: false},
                          result);
    });

    it("Simple", async () =>
    {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        toda._getSalt = () => new ByteArray(new TextEncoder().encode("I am salty!"));
        let twist = await mint(toda, 43, 1);
        let dq = Abject.fromTwist(twist);
        let [delegate, delegator] = await toda.delegateValue(dq, 3.4);

        let result = await toda.getBalance(twist.getHash());

        assert.deepEqual({balance: 4.3,
                          quantity: 43,
                          type: twist.getHash().toString(),
                          files: [delegator.getHash().toString(),
                                  delegate.getHash().toString()],
                          recalculating: false},
                          result);
    });

    it("Uncontrolled", async () =>
    {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        toda._getSalt = () => new ByteArray(new TextEncoder().encode("I am salty!"));
        let twist = await mint(toda, 43, 1);
        let dq = Abject.fromTwist(twist);
        let [delegate, delegator] = await toda.delegateValue(dq, 3.4);

        // Delegator is no longer controlled by address
        await toda.append(delegator,
                          Hash.fromHex("41896f0dcf6ac269b867186c16db10cc6db093f1b8064cbf44a6d6e9e7f2921bd5"));

        let result = await toda.getBalance(twist.getHash());

        assert.deepEqual({balance: 3.4,
                          quantity: 34,
                          type: twist.getHash().toString(),
                          files: [delegate.getHash().toString()],
                          recalculating: false},
                          result);
    });
});

describe("delegateValue", async () => {
    it("Simple", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        toda._getSalt = () => new ByteArray(new TextEncoder().encode("I am salty!"));
        let twist = await mint(toda, 43, 1);
        let dq = Abject.fromTwist(twist);
        let [delegate, delegator] = await toda.delegateValue(dq, 3.4);
        assert.ok(Abject.fromTwist(delegate).delegateOf().getHash().equals(delegator.getHash()));
        assert.equal(Abject.fromTwist(delegate).quantity, 34);
        assert.equal(Abject.fromTwist(delegator).quantity, 9);
        assert.ok(Abject.fromTwist(delegate).rootId().equals(twist.getHash()));
        assert.ok(Abject.fromTwist(delegator).rootId().equals(twist.getHash()));
    });

    it("Nested", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        toda._getSalt = () => new ByteArray(new TextEncoder().encode("I am salty!"));
        let twist = await mint(toda, 43, 1);
        let dq = Abject.fromTwist(twist);
        let [delegate, delegator] = await toda.delegateValue(dq, 3.4);
        dq = Abject.fromTwist(delegate);
        [delegate, delegator] = await toda.delegateValue(dq, 2.4);
        assert.ok(Abject.fromTwist(delegate).delegateOf().getHash().equals(delegator.getHash()));
        assert.equal(Abject.fromTwist(delegate).quantity, 24);
        assert.equal(Abject.fromTwist(delegator).quantity, 10);
        assert.ok(Abject.fromTwist(delegate).rootId().equals(twist.getHash()));
        assert.ok(Abject.fromTwist(delegator).rootId().equals(twist.getHash()));
    });

    it("Client cannot satisfy DQ", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        toda._getSalt = () => new ByteArray(new TextEncoder().encode("I am salty!"));
        let twist = await mint(toda, 43, 1);
        let dq = Abject.fromTwist(twist);

        // New client does not have satisfier
        toda = new TodaClient(inv, "http://localhost:8000");
        await assert.rejects(toda.delegateValue(dq, 2.2));
    });


    it("Not enough qty", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        toda._getSalt = () => new ByteArray(new TextEncoder().encode("I am salty!"));
        let twist = await mint(toda, 43, 1);
        let dq = Abject.fromTwist(twist);
        await assert.rejects(toda.delegateValue(dq, 8.2));
    });

    it("NaN", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        toda._getSalt = () => new ByteArray(new TextEncoder().encode("I am salty!"));
        let twist = await mint(toda, 43, 1);
        let dq = Abject.fromTwist(twist);
        await assert.rejects(toda.delegateValue(dq, "EIGHTEEN"));
    });

    it("Delegate value updates its tether", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        toda._getSalt = () => new ByteArray(new TextEncoder().encode("I am salty!"));

        let relayTwist0 = await toda.create();
        let relayTwist1 = await toda.append(relayTwist0);

        let twist = await mint(toda, 43, 1, relayTwist0.getHash());
        twist.addAtoms(relayTwist1.getAtoms());
        let dq = Abject.fromTwist(twist);
        let [delegate, delegator] = await toda.delegateValue(dq, 3.4);
        assert.ok(twist.getTetherHash().equals(relayTwist0.getHash()));
        // Delegate + delegator now point to a newer twist
        assert.ok(delegate.tether().findPrevious(relayTwist1.getHash()));
        assert.ok(delegator.tether().findPrevious(relayTwist1.getHash()));
    });
});

describe("transfer", async () => {
    it("Exact", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        let destHash = Hash.fromHex("41896f0dcf6ac269b867186c16db10cc6db093f1b8064cbf44a6d6e9e7f2921bd5");
        toda._getSalt = () => new ByteArray(new TextEncoder().encode("I am salty!"));
        let twist = await mint(toda, 43, 1);
        let newTwists = await (await toda.transfer({amount: 4.3,
                                                    typeHash: twist.getHash(),
                                                    destHash}));
        assert.equal(newTwists.length, 1);
        let newTwist = newTwists[0];
        assert.ok(newTwist.getTetherHash().equals(destHash));
        assert.equal((await toda.getBalance(twist.getHash())).balance, 0);
        assert.deepEqual(newTwists.map(t => Abject.fromTwist(t).quantity),
                         [43]);
    });

    it("Excess", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        let destHash = Hash.fromHex("41896f0dcf6ac269b867186c16db10cc6db093f1b8064cbf44a6d6e9e7f2921bd5");
        toda._getSalt = () => new ByteArray(new TextEncoder().encode("I am salty!"));
        let twist = await mint(toda, 43, 1);
        let newTwists = await (await toda.transfer({amount: 3.1,
                                                    typeHash: twist.getHash(),
                                                    destHash}));
        assert.equal(newTwists.length, 1);
        let newTwist = newTwists[0];
        assert.ok(newTwist.getTetherHash().equals(destHash));
        assert.equal((await toda.getBalance(twist.getHash())).balance, 1.2);
        assert.deepEqual(newTwists.map(t => Abject.fromTwist(t).quantity),
                         [31]);
    });

    it("Multiple exact change", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        let destHash = Hash.fromHex("41896f0dcf6ac269b867186c16db10cc6db093f1b8064cbf44a6d6e9e7f2921bd5");
        toda._getSalt = () => new ByteArray(new TextEncoder().encode("I am salty!"));
        let twist = await mint(toda, 45, 1);
        let [delegate, delegator] = await toda.delegateValue(Abject.fromTwist(twist), 3);
        await toda.delegateValue(Abject.fromTwist(delegate), 1.5);
        // Now there are three bills: 1.5, 1.5, 1.5
        let newTwists = await (await toda.transfer({amount: 3,
                                                    typeHash: twist.getHash(),
                                                    destHash}));
        assert.equal(newTwists.length, 2);
        assert.equal((await toda.getBalance(twist.getHash())).balance, 1.5);
        assert.deepEqual(newTwists.map(t => Abject.fromTwist(t).quantity),
                     [15, 15]);
    });

    it("Multiple change", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8000");
        let destHash = Hash.fromHex("41896f0dcf6ac269b867186c16db10cc6db093f1b8064cbf44a6d6e9e7f2921bd5");
        toda._getSalt = () => new ByteArray(new TextEncoder().encode("I am salty!"));
        let twist = await mint(toda, 43, 1);
        // Now there are two bills: 2.6 and 1.7
        await toda.delegateValue(Abject.fromTwist(twist), 2.6);
        let newTwists = await (await toda.transfer({amount: 3.1,
                                                    typeHash: twist.getHash(),
                                                    destHash}));
        assert.equal(newTwists.length, 2);
        assert.equal((await toda.getBalance(twist.getHash())).balance, 1.2);
        assert.equal(newTwists.map(t => Abject.fromTwist(t).quantity).reduce((x, y) => x + y, 0),
                     31);
    });
});