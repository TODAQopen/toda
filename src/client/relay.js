import { Atoms } from '../core/atoms.js';
import { ByteArray } from '../core/byte-array.js';
import { Sha256 } from '../core/hash.js';
import { Twist } from '../core/twist.js';
import { Line } from '../core/line.js';
import { Interpreter } from '../core/interpret.js';
import { Packet } from '../core/packet.js';
import axios from 'axios';

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
            //console.warn("Error getting hoist:", e);
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
            url: this.url.toString(),
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

class NextRelayClient extends RelayClient {
    constructor(tetherHash) {
        super();
        this.tetherHash = tetherHash;
    }

    async get() {
        let twists = [...(await this._backwards(this.tetherHash)), ...(await this._forwards(this.tetherHash))];
        if (twists.length == 0) {
            return null;
        }
        let twist = twists.slice(-1)[0];
        twists.forEach(t => twist.safeAddAtoms(t.getAtoms()));
        return twist;
    }

    async _backwards(prevHash) {
        let twist = (await this._getNext(prevHash))?.prev();
        if (!twist) {
            return [];
        } 
        if (twist.isTethered()) {
            await this._populateShield(twist);
            return [twist]; // no need to go further back
        }
        return [...(await this._backwards(twist.getPrevHash())), twist];
    }

    async _forwards(nextHash) {
        let twist = await this._getNext(nextHash);
        if (!twist) {
            return [];
        }
        if (twist.isTethered()) {
            await this._populateShield(twist);
        }
        return [twist, ...(await this._forwards(twist.getHash()))];
    }

    async _populateShield(twist) {
        let shield = await this._getShield(twist.getHash());
        if (shield) {
            twist.safeAddAtom(twist.getShieldHash(), shield);
        }
    }
}

class RemoteNextRelayClient extends NextRelayClient {
    constructor(relayUrl, fileServerUrl, tetherHash) {
        super(tetherHash);
        this.fileServerUrl = fileServerUrl;
        this.relayUrl = relayUrl;
    }

    _hoist(atoms) {
        console.log("Hoisting to: ", this.relayUrl.toString());
        return axios({
            method: "POST",
            url: this.relayUrl.toString(),
            headers: {
                "Content-Type": "application/octet-stream"
            },
            data: atoms.toBytes()
        });
    }

    async _getNext(twistHash) {
        let resp = await axios({
            method: "GET",
            url: "/" + twistHash + ".next.toda",
            baseURL: this.fileServerUrl,
            responseType: "arraybuffer"
        }).catch(_ => null);
        if (resp) {
            return Twist.fromBytes(new ByteArray(resp.data));
        }
    }

    async _getShield(twistHash) {
        let resp = await axios({
            method: "GET",
            url: "/" + twistHash + ".shield",
            baseURL: this.fileServerUrl,
            responseType: "arraybuffer"
        }).catch(_ => null);
        if (resp) {
            return Packet.parse(new ByteArray(resp.data));
        }
    }
}


export { LocalRelayClient,
         RemoteRelayClient,
         NextRelayClient,
         RemoteNextRelayClient };