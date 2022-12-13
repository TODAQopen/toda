const { Atoms } = require("../core/atoms");
const { ByteArray } = require("../core/byte-array");
const { Sha256 } = require("../core/hash");
const { Twist } = require("../core/twist");
const { Line } = require("../core/line");
const { Interpreter } = require("../core/interpret");

const axios = require("axios");

class RelayClient {

    hoist(prevTwist, nextHash) {
        return this.hoistPacket(prevTwist.hoistPacket(nextHash));
    }

    hoistPacket(riggingPacket) {
        return this._hoist(new Atoms([[Sha256.fromPacket(riggingPacket), riggingPacket]]));
    }

    _hoist(atoms) {
        throw new Error('not implemented');
    }

    // TODO(acg): add params to request slice
    get() {
        throw new Error('not implemented');
    }

    /** Retrieves the hoist hitch for the specified lead
     * @param lead <Twist> the lead whose hitch to verify
     * @returns Promise<Twist|null> The hash of the hitch hoist if it exists, or null
     */
    async getHoist(lead) {
        let relay = await this.get();
        let i = new Interpreter(Line.fromTwist(relay).addAtoms(lead.getAtoms())); //awkward
        try {
            return i.hitchHoist(lead.getHash());
        } catch (e) {
            console.warn("Error getting hoist:", e);
            return null;
        }
    }
}

class RemoteRelayClient extends RelayClient {

    constructor(url) {
        super();
        this.url = new URL(url);
    }

    _hoist(atoms) {
        console.log("Hoisting to: ", this.url.toString());
        return axios({
            method: "POST",
            //XXX(acg): I **HATE** this.
            url: this.url.toString() + "hoist",
            headers: {
                "Content-Type": "application/octet-stream"
            },
            data: atoms.toBytes()
        });
    }

    _getBytes(startHash) {
        let queryString = "";
        if (startHash) {
            queryString = "?start-hash=" + startHash.toString();
        }
        return axios({
            method: "GET",
            url: this.url.toString() + queryString,
            responseType: "arraybuffer"
        }).then(res => new ByteArray(res.data));
    }

    get(startHash) {
        return this._getBytes(startHash).then(bytes => new Twist(Atoms.fromBytes(bytes)));
    }
}

class LocalRelayClient extends RelayClient {

    constructor(todaClient, hash) {
        super();

        if (!hash) {
            throw Error('relay requires a line.');
        }

        this.hash = hash;
        this.client = todaClient;
    }

    _hoist(atoms) {
        console.log("Hosting to local: ", this.hash.toString());
        let relay = this.get();

        // heuristic.  use current key if last update was keyed
        let req = relay.reqs() ? this.client.requirementSatisfiers[0] : null;
        // heuristic. use last tether if last update was tethered
        let tether = relay.isTethered() ? relay.getTetherHash() : null;

        return this.client.append(relay, tether, req, undefined, undefined,
                           atoms.lastPacket());
    }

    get() {
        return this.client.get(this.hash);
    }
}

exports.LocalRelayClient = LocalRelayClient;
exports.RemoteRelayClient = RemoteRelayClient;
