import { Atoms } from '../core/atoms.js';
import { ByteArray } from '../core/byte-array.js';
import { Sha256 } from '../core/hash.js';
import { Twist } from '../core/twist.js';
import { Line } from '../core/line.js';
import { Interpreter } from '../core/interpret.js';
import { Packet } from '../core/packet.js';
import axios from 'axios';

class RelayClient {
    constructor(tetherHash, backwardsStopPredicate) {
        this.tetherHash = tetherHash;
        this.backwardsStopPredicate = backwardsStopPredicate;
    }

    hoist(prevTwist, nextHash, opts) {
        return this._hoist(prevTwist, nextHash, opts);
    }

    hoistPacket(riggingPacket, opts) {
        return this._hoist(Atoms.fromPairs(
            [[Sha256.fromPacket(riggingPacket), riggingPacket]]), opts);
    }

    _hoist(prevTwist, nextHash) {
        throw new Error('Not implemented in abstract class');
    }

    async get() {
        const backwardsPromise = this._backwards(this.tetherHash);
        const forwardsPromise = this._forwards(this.tetherHash);
        const twists = [...(await backwardsPromise), 
                        ...(await forwardsPromise)];
        if (twists.length == 0) {
            return null;
        }
        const twist = twists[twists.length-1];
        // Significantly more performant than `forEach(twist.safeAdd...`
        const atoms = Atoms.fromAtoms(...twists.flatMap(t => t.atoms||[]));
        twist.addAtoms(atoms);
        return twist;
    }

    /** Retrieves the hoist hitch for the specified lead
     * @param lead <Twist> the lead whose hitch to verify
     * @returns Promise<Twist|null> The hash of the hitch 
     *  hoist if it exists, or null
     */
    async getHoist(lead) {
        let relayTwist = await this.get();
        if (!relayTwist) return {};
        let i = new Interpreter(
            Line.fromTwist(relayTwist).addAtoms(lead.getAtoms())); //awkward
        try {
            return {hoist: i.hitchHoist(lead.getHash()), relayTwist};
        } catch (e) {
            return {};
        }
    }

    async _backwards(prevHash) {
        const twist = (await this._getNext(prevHash))?.prev();
        if (!twist) {
            return [];
        }
        if (twist.isTethered()) {
            await this.populateShield(twist);
            return [twist]; // no need to go further back
        }
        if (this.backwardsStopPredicate && this.backwardsStopPredicate(twist)) {
            return [twist]; // short circuit
        }
        return [...(await this._backwards(twist.getPrevHash())), twist];
    }

    async _forwards(nextHash) {
        const twist = await this._getNext(nextHash);
        if (!twist) {
            return [];
        }
        if (twist.isTethered()) {
            await this.populateShield(twist);
        }
        return [twist, ...(await this._forwards(twist.getHash()))];
    }

    async populateShield(twist) {
        if (twist.get(twist.getShieldHash())) {
            return;
        }

        const shield = await this._getShield(twist.getHash());
        if (shield) {
            twist.atoms.set(twist.getShieldHash(), shield);
        }
    }
}

class LocalRelayClient extends RelayClient {

    constructor(todaClient, hash) {
        super(hash, null);

        if (!hash) {
            throw Error('relay requires a line.');
        }
        this.client = todaClient;
    }

    /**
     * Given a twist, returns an atoms object containing a 
     *  trimmed version of its graph, containing:
     *  the twist packet, the body packet, the req packet (and all contents),
     *  the sat packet (and all contents), and the rigging packet.
     * Note that the cargo and the shield are omitted
     * @param {Twist} twist
     * @returns {Atoms}
     */
    _isolateTwist(twist) {
        const isolated = new Atoms();
        isolated.set(twist.getBodyHash(), twist.getBody());
        // We don't want to expand the rigging: only want the pairtrie itself
        const rigging = twist.get(twist.getBody().getRiggingHash());
        if (rigging) {
            isolated.set(twist.getBody().getRiggingHash(), rigging);
        }
        function expandHash(twist, hash) {
            let packet = twist.get(hash);
            if (!packet) {
                return;
            }
            isolated.set(hash, packet);
            packet.getContainedHashes?.().forEach(h => expandHash(twist, h));
        }
        // Completely expand reqs + sats
        expandHash(twist, twist.getBody().getReqsHash());
        expandHash(twist, twist.getPacket().getSatsHash());
        isolated.set(twist.getHash(), twist.getPacket());
        isolated.focus = twist.getHash();
        return isolated;
    }

    async _hoist(prevTwist, nextHash, { noFast } = {}) {
        let relay = await this.client.get(this.tetherHash);

        // heuristic.  use current key if last update was keyed
        let req = relay.reqs() ? this.client.requirementSatisfiers[0] : null;

        let tether;
        if (noFast) {
            // Leave tether undefined
        } else if (relay.isTethered()) {
            tether = relay.getTetherHash();
        } else {
            tether = relay.lastFast()?.getTetherHash();
        }

        const t = await this.client.append(relay, tether, 
                req, undefined, undefined,
            prevTwist.hoistPacket(nextHash));
        return t;
    }

    _getNext(twistHash) {
        const twist = this.client.get(this.tetherHash);
        const next = twist?.findLast(t => t.getPrevHash().equals(twistHash));
        const prev = next?.prev();
        if (!prev) {
            return null;
        }
        const isolated = new Twist(this._isolateTwist(next), next.getHash());
        isolated.addAtoms(this._isolateTwist(prev));
        return isolated;
    }

    /**
     * Determine whether or not the shield of `predecessorHash` is safe
     *  to publicize
     * Recall that we need to keep the most recent fast twist's shield private.
     * @param {Twist} twist
     * @param {Hash} predecessorHash
     * @returns {Boolean}
     */
    static shieldIsPublic(twist, predecessorHash) {
        if (twist.isTethered()) {
            // If this twist is tethered, then any other twist is public
            return !twist.getHash().equals(predecessorHash);
        }
        // Otherwise, any twist other than lastFast is public
        return !twist.lastFast()?.getHash().equals(predecessorHash);
    }

    _getShield(twistHash) {
        const twist = this.client.get(this.tetherHash);
        if (twist && LocalRelayClient.shieldIsPublic(twist, twistHash)) {
            return twist.findPrevious(twistHash)?.shield();
        }
        return null;
    }
}

/**
 * @param backwardsStopPredicate <fn(twist) => bool>: if specified, 
 *   get() will stop walking backwards when it sees a twist that 
 *   matches the predicate
 */
class RemoteRelayClient extends RelayClient {

    static globalNextCache = {};
    static globalShieldCache = {};

    constructor(relayUrl, fileServerUrl, tetherHash, backwardsStopPredicate) {
        super(tetherHash, backwardsStopPredicate);
        this.fileServerUrl = fileServerUrl;
        this.relayUrl = relayUrl;
    }

    async _hoist(prevTwist, nextHash) {
        const hoistPacket = prevTwist.hoistPacket(nextHash);
        const data = {'relay-twist': prevTwist.getTetherHash().toString(),
                      'hoist-request': {}};
        hoistPacket.getShapedValueFromContent().forEach((v, k) => {
            data['hoist-request'][k] = v.toString();
        });
        return await axios({
            method: "POST",
            url: this.relayUrl.toString(),
            headers: {
                "Content-Type": "application/json"
            },
            data
        });
    }

    async _getNext(twistHash) {
        if (RemoteRelayClient.globalNextCache[twistHash]) {
            return RemoteRelayClient.globalNextCache[twistHash];
        }

        const resp = await axios({
            method: "GET",
            url: "/" + twistHash + ".next.toda",
            baseURL: this.fileServerUrl,
            responseType: "arraybuffer"
        }).catch(() => null);
        if (resp) {
            const x = Twist.fromBytes(new ByteArray(resp.data));
            RemoteRelayClient.globalNextCache[twistHash] = x;
            return x;
        }
        return null;
    }

    async _getShield(twistHash) {
        if (RemoteRelayClient.globalShieldCache[twistHash]) {
            return RemoteRelayClient.globalShieldCache[twistHash];
        }

        const resp = await axios({
            method: "GET",
            url: "/" + twistHash + ".shield",
            baseURL: this.fileServerUrl,
            responseType: "arraybuffer"
        }).catch(() => null);
        if (resp) {
            const x = Packet.parse(new ByteArray(resp.data));
            RemoteRelayClient.globalShieldCache[twistHash] = x;
            return x;
        }
        return null;
    }
}

export { LocalRelayClient,
         RemoteRelayClient };
