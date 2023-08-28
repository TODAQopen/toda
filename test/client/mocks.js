import { Abject } from "../../src/abject/abject.js";
import { ByteArray } from "../../src/core/byte-array.js";
import { TodaClient } from "../../src/client/client.js";
import { SimpleHistoric } from "../../src/abject/simple-historic.js";
import { SECP256r1 } from "../../src/client/secp256r1.js";
import { LocalInventoryClient } from "../../src/client/inventory.js";
import { Atoms } from "../../src/core/atoms.js";
import { Hash } from "../../src/core/hash.js";
import { PairTriePacket } from "../../src/core/packet.js";
import { URL } from 'url';
import nock from "nock";
import { v4 as uuidv4 } from 'uuid';

import axios from 'axios';
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
   Returns an Atoms object that contains *only* this body,
   this twist, and the contents of this req, cargo, shield, and sat
   (ie, all extraneous data, including previous and tethered
   twists are pared)
*/
function isolateTwist(twist) {
    let isolated = new Atoms();
    isolated.set(twist.getBodyHash(), twist.getBody());
    // We don't want to actually expand the rigging: 
    //  only want the pairtrie itself
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
    // isolated.forceSetLast(twist.getHash(), twist.getPacket());
    isolated.set(twist.getHash(), twist.getPacket());
    isolated.focus = twist.getHash();
    return isolated;
}

/**
  Runs isolateTwist from <earliestHash> to <twist.getHash()>,
   merging the results
  */
function isolateSegment(twist, earliestHash) {
    let isolated = new Atoms();
    let prev = twist;
    while (prev) {
        isolated.merge(isolateTwist(prev));
        if (prev.getHash().equals(earliestHash)) {
            break;
        }
        prev = prev.prev();
    }
    // isolated.forceSetLast(twist.getHash(), twist.getPacket());
    isolated.set(twist.getHash(), twist.getPacket());
    isolated.focus = twist.getHash();
    return isolated;
}

// An interface for creating simple historic lines
//  Use `startNockServer` if you'd like it to behave
//  as a remote (instant) relay
class MockSimpleHistoricRelay {
    constructor(thisUrl, tetherUrl, toplineHash) {
        this.thisUrl = thisUrl;
        this.tetherUrl = tetherUrl;
        this.toplineHash = toplineHash;
    }

    async initialize() {
        this.kp = await SECP256r1.generate();
        this.logs = [];
        this.dirPath = `${__dirname}/files/` + uuidv4();
        if (!fs.existsSync(this.dirPath)) {
            fs.mkdirSync(this.dirPath);
        }
        this.client = new TodaClient(new LocalInventoryClient(this.dirPath));
        this.client.defaultTopLineHash = this.toplineHash;
        let saltPath = this.dirPath + "/salt";
        fs.writeFileSync(saltPath, Buffer.from(uuidv4(), 'utf8'));
        this.client.shieldSalt = saltPath;
        this.client.addSatisfier(this.kp);
        let firstAbj = new SimpleHistoric();
        firstAbj.set(new Date().toISOString(), this.tetherUrl, this.thisUrl);
        let tether;
        if (this.tetherUrl) {
            tether = await axios({
                method: "GET",
                url: this.tetherUrl + "/latest",
                responseType: "arraybuffer"
            })
                .then(res => new ByteArray(res.data))
                .then(res => Hash.parse(res));
        }

        let first = await this.client.finalizeTwist(
            firstAbj.buildTwist(), tether, this.kp);
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

    clearLogs() {
        this.logs = [];
    }

    serve() {
        if (!this.thisUrl) {
            throw new Error("Wasn't initialized with the parameter 'thisUrl'");
        }
        nock(this.thisUrl)
            .persist()
            .get('/latest')
            .reply(200, async (uri, requestBody) => {
                let response = Buffer.from(this.latest().getHash().toBytes());
                this.logs.push({ method: "get", uri, requestBody, response });
                return response;
            });

        nock(this.thisUrl)
            .persist()
            .get('/')
            .reply(200, async (uri, requestBody) => {
                let response = Buffer.from(this.latest().getAtoms().toBytes());
                this.logs.push({ method: "get", uri, requestBody, response });
                return response;
            });

        nock(this.thisUrl)
            .persist()
            .get('/')
            .query(queries => queries["start-hash"])
            .reply(200, async (uri, requestBody) => {
                let queries = new URL(uri, this.thisUrl).searchParams;
                let startHash = Hash.fromHex(queries.get("start-hash"));
                let isolated = isolateSegment(this.latest(), startHash);
                let response = Buffer.from(isolated.toBytes());
                this.logs.push({ method: "get", uri, requestBody, response });
                return response;
            });

        // note that in the body of the callback function `this` refers to axios
        let server = this;
        nock(this.thisUrl)
            .persist()
            .post('/')
            .query({})
            .reply(200, async function (uri, requestBodyHex) {
                let atoms = Atoms.fromBytes(this.req.requestBodyBuffers[0]);
                let riggingPacket = atoms.get(atoms.focus);
                // TODO: this is a bit gross; theoretically it could be the latest but it doesn't really matter :shrug:
                let tether = server.latest().getTetherHash();
                let next = await server.append(tether, riggingPacket);
                server.logs.push({ method: "post", uri, requestBodyHex });
            });
    }
}

function returnFile(directory, uri) {
    let fileName = path.join(directory, uri);
    if (fs.existsSync(fileName)) {
        return [200, fs.readFileSync(fileName), { 'Content-Type': 'application/octet-stream'}];
    }
    return [404];
}

function nockLocalFileServer(directory, port) {
    nock("http://localhost:" + port)
    .persist()
    .get(/.*/)
    .reply((uri) => returnFile(directory, uri));
}

function nock404FileServer(port) {
    nock("http://localhost:" + port)
    .persist()
    .get(/.*/)
    .reply(() => [404]);
}

export { MockSimpleHistoricRelay };
export { isolateTwist, isolateSegment };
export { nockLocalFileServer, nock404FileServer };