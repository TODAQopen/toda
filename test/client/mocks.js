/*************************************************************
 * TODAQ Open: TODA File Implementation
 * Toronto 2022
 *
 * Apache License 2.0
 *************************************************************/

const { Abject } = require("../../src/abject/abject");
const { TodaClient, WaitForHitchError } = require("../../src/client/client");
const { SimpleHistoric } = require("../../src/abject/simple-historic");
const { SECP256r1 } = require("../../src/client/secp256r1");
const { LocalInventoryClient, VirtualInventoryClient } = require("../../src/client/inventory");

const { Atoms } = require("../../src/core/atoms");
const { Hash, Sha256 } = require("../../src/core/hash");

const { PairTriePacket } = require("../../src/core/packet");
const { URL } = require('url');

const path = require("path");
const nock = require("nock");
const { v4: uuidv4 } = require('uuid');

/**
   Returns an Atoms object that contains *only* this body,
   this twist, and the contents of this req, cargo, shield, and sat
   (ie, all extraneous data, including previous and tethered
   twists are pared)
*/
function isolateTwist(twist) {
    let isolated = new Atoms();
    isolated.set(twist.getBodyHash(), twist.getBody());
    // We don't want to actually expand the rigging: only want the pairtrie itself
    let rigging = twist.get(twist.getBody().getRiggingHash());
    if (rigging) {
        isolated.set(twist.getBody().getRiggingHash(), rigging);
    }

    function expandHash(twist, hash) {
        let packet = twist.get(hash);
        if (packet) {
            isolated.set(hash, packet);
        }
        if (packet instanceof PairTriePacket) {
            packet.getContainedHashes().forEach(h => expandHash(twist, h));
        }
    }

    expandHash(twist, twist.getBody().getReqsHash());
    expandHash(twist, twist.getBody().getShieldHash());
    expandHash(twist, twist.getBody().getCargoHash());
    expandHash(twist, twist.getPacket().getSatsHash());
    isolated.forceSetLast(twist.getHash(), twist.getPacket());
    return isolated;
}


class MockSimpleHistoricRelay
{
    constructor(thisUrl, tetherUrl) {
        this.thisUrl = thisUrl;
        this.tetherUrl = tetherUrl;
    }

    async initialize() {
        this.kp = await SECP256r1.generate();
        this.logs = [];
        this.dirPath = `${__dirname}/files/` + uuidv4();
        this.client = new TodaClient(new LocalInventoryClient(this.dirPath));
        this.client.shieldSalt = path.resolve(__dirname, "./files/salt");
        this.client.addSatisfier(this.kp);
        let firstAbj = new SimpleHistoric();
        firstAbj.set(new Date().toISOString(), this.tetherUrl, this.thisUrl);
        let first = await this.client.finalizeTwist(firstAbj.buildTwist(), undefined, this.kp);
        this.index = [first];
    }

    async append(tether, riggingPacket) {
        let lastAbj = Abject.fromTwist(this.latest());
        let nextAbj = lastAbj.createSuccessor();
        nextAbj.set(new Date().toISOString(), this.tetherUrl, this.thisUrl);
        let nextTb = nextAbj.buildTwist();
        nextTb.setRiggingPacket(riggingPacket);
        let next = await this.client.finalizeTwist(nextTb, tether, this.kp);
        this.index.push(next);
        return next;
    }

    first() {
        return this.index[0];
    }

    latest() {
        return this.index.slice(-1)[0];
    }

    twists() {
        return [...this.index];
    }

    nockEndpoints(baseUrl) {
        nock(baseUrl)
            .persist()
            .get('/')
            .reply(200, async (uri, requestBody) => {
                  let response = Buffer.from(this.latest().getAtoms().toBytes());
                  this.logs.push({method: "get", uri, requestBody, response});
                  return response;
                });

        nock(baseUrl)
            .persist()
            .get('/')
            .query(queries => queries["start-hash"])
            .reply(200, async (uri, requestBody) => {
                    let queries = new URL(uri, baseUrl).searchParams;
                    let startHash = Hash.fromHex(queries.get("start-hash"));
                    let isolated = new Atoms();
                    let latestH = this.latest().getHash();
                    let latestP = this.latest().getPacket();
                    let prev = this.latest();
                    while(prev) {
                        isolated.merge(isolateTwist(prev));
                        if (prev.getHash().equals(startHash)) {
                            break;
                        }
                        prev = prev.prev();
                    }
                    isolated.forceSetLast(latestH, latestP);
                    let response = Buffer.from(isolated.toBytes());
                    this.logs.push({method: "get", uri, requestBody, response});
                    return response;
                });

        // note that in the body of the callback function `this` refers to axios
        let server = this;
        nock(baseUrl)
            .persist()
            .post('/')
            .query({})
            .reply(200, async function (uri, requestBodyHex) {
                let riggingPacket = Atoms.fromBytes(this.req.requestBodyBuffers[0]).lastPacket();
                // TODO: this is a bit gross; theoretically it could be the latest but it doesn't really matter :shrug:
                let tether = server.latest().getTetherHash();
                if (!tether || tether.isNull()) {
                    tether = server.latest().lastFast()?.getTetherHash();
                }
                let next = await server.append(tether, riggingPacket);
                server.logs.push({method: "post", uri, requestBodyHex});
            });
    }
}

exports.MockSimpleHistoricRelay = MockSimpleHistoricRelay;
exports.isolateTwist = isolateTwist;
