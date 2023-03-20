/*************************************************************
 * TODAQ Open: TODA File Implementation
 * Toronto 2022
 *
 * Apache License 2.0
 *************************************************************/

//const { keysPaired, SignatureRequirement } = require("../core/reqsat");
const { Abject } = require("../abject/abject");
const { ByteArray } = require("../core/byte-array");
const { LocalRelayClient, RemoteRelayClient } = require("./relay");
const { Hash, Sha256, NullHash } = require("../core/hash");
const { ArbitraryPacket } = require("../core/packet");
const { TwistBuilder, Twist } = require("../core/twist");
const { Interpreter } = require("../core/interpret");
const { Line } = require("../core/line");
const fs = require("fs-extra");

class TodaClient {

    constructor(inventory) {

        this.inv = inventory;

        /** Always set the tether on a new twist to the old value if none specified. */
        this.autoTether = false;

        /** Use this default for evaluating non-abjects when no top is specified. */
        /** Also use this default when creating new abjects when no top is specified. */
        this.defaultTopLine = "https://slow.line.todaq.net";
        this.defaultTopLineHash = null;

        this.defaultRelayHash = null;
        this.defaultRelayUrl = null;
        this.shieldSalt = "~/.toda/.salt";

        this.requirementSatisfiers = [];

        this.retryTimes = 3;
        this.retryInterval = 1000;

        this.appendLocks = {};
    }

    addSatisfier(rs) {
        this.requirementSatisfiers.push(rs);
    }

    _defaultRelay(twist) {
        /*if (this.defaultRelayHash && !twist.findPrevious(this.defaultRelayHash)) {
            return new LocalRelayClient(this, this.defaultRelayHash);
        }*/
        if (this.defaultRelayUrl) {
            console.log("returning default relay url:", this.defaultRelayUrl);
            return new RemoteRelayClient(this.defaultRelayUrl);
        }
        console.error("No default relay found.");
        return null;
    }

    /**
     * FIXME(acg): This needs to make sure the thing retrieved actually does
     * contain the tether.
     */
    getRelay(twist) {
        if (twist.getTetherHash().isNull()) {
            let lastFast = twist.lastFast();
            if (lastFast) {
                return this.getRelay(lastFast);
            }
            return undefined;
        }
        console.log("getting relay for:", twist.getHash().toString(), "tethered to:",
                    twist.getTetherHash().toString());
        try {
            let abj = Abject.fromTwist(twist);
            if (abj && abj.tetherUrl && abj.tetherUrl()) { //duck-duck-go
                return new RemoteRelayClient(abj.tetherUrl());
            }
        } catch (e) {}

        if (this.get(twist.getTetherHash())) {
            return new LocalRelayClient(this, twist.getTetherHash());
        }
        return this._defaultRelay(twist);
    }

    getRelayFromString(relayStr) {
        // mostly used for pulling down poptop reference.
        if (relayStr.length == 66) { // I SAID, I'm SORRY!
            return new LocalRelayClient(this, Hash.fromHex(relayStr));
        }
        console.error("RELAYSTR:", relayStr, relayStr.length);
        return new RemoteRelayClient(relayStr);
    }

    // typically used for looking up tethers, where we don't know if the proof
    // is in this file or another.
    getFromAtomsOrInventory(atoms, hash) {
        if (atoms.has(hash)) {
            return new Twist(atoms, hash);
        }
        return this.get(hash);
    }

    get(hash) {
        let atoms = this.inv.get(hash);
        if (atoms) {
            return new Twist(atoms);
        }
        return null;
    }

    getExplicitPath(path) {
        // assumes current inv is a LocalInventoryClient
        return new Twist(this.inv.getExplicitPath(path));
    }

    _shouldShield(tb) {
        // Heuristic.
        // If the tether does not appear to be local, we add a shield.
        return !this.get(tb.getTetherHash());
    }

    _getSalt() {
        return new ByteArray(fs.readFileSync(this.shieldSalt));
    }

    _generateShield(hash) {
        hash = hash || new NullHash();
        return Sha256.hash(this._getSalt().concat(hash.serialize()));
    }

    // TODO: support explicit shields later.  only salted ones for now.
    _setShield(tb) {
        if (this._shouldShield(tb)) {
            tb.setShield(new ArbitraryPacket(this._generateShield(tb.getPrevHash())));
            // xxx(acg): perhaps have twistbuilder create the packet
        } else {
            //console.log("NOT setting shield.");
        }
    }

    async _setPost(tb) {
        const lead = tb.twist().lastFast()?.lastFast();
        if (lead) {
            // temporary hackitty hack
            // does this twist already contain the hoisting info?
            let local = new LocalRelayClient(this, tb.twist().lastFast().getHash());
            let h = await local.getHoist(lead);
            if (h) {
                tb.addRigging(lead.getHash(), h.getHash());
                return;
            }

            // orig:
            let relay = this.getRelay(lead);
            if (!relay) {
                console.error("NO RELAY FOUND FOR:", lead.getHash().toString());
                throw new WaitForHitchError(); //TODO: specialize this error
            }

            let attempts = 0;
            while (attempts < this.retryTimes) {
                attempts++;
                let hitch = await relay.getHoist(lead);
                if (hitch) {
                    tb.addRigging(lead.getHash(), hitch.getHash());
                    return;
                } else {
                    console.warn("Requerying for hitch...");
                    await new Promise(res => setTimeout(res, this.retryInterval));
                }
            }
            throw new WaitForHitchError();
        }
        //TODO(acg): why wouldn't we also not take advantage of having grabbed
        //all those proof atoms and save em?
    }

    create(tether, req, cargo, opts) {
        return this._append(null, new TwistBuilder(), tether, req, cargo, undefined, undefined, opts);
    }

    /**
     * @param prev <Twist>
     * @param tether <Hash>
     * @param req
     * @param cargo <Atoms> //primary cargo is last atom
     */
    append(prev, tether, req, cargo, preSignHook, rigging, opts) {
        // TODO(acg): re-introduce already-existing successor check here.

        return this._append(prev, prev.createSuccessor(), tether, req, cargo, preSignHook, rigging, opts);
    }

    /**
     * @param twistBuilder <TwistBuilder> the twist to build
     * @param tetherHash <Hash>
     * @param req <Requirement> the requirements to use
     */
    finalizeTwist(twistBuilder, tetherHash, req, opts)
    {
        return this._append(twistBuilder.prev(),
                            twistBuilder,
                            tetherHash ?? twistBuilder.getTetherHash(),
                            req,
                            undefined, undefined, undefined, opts);
    }

    /**
     * @param prev <Twist?>
     * @param next <TwistBuilder>
     * @param tether <Hash>
     * @param req <RequirementSatisfier>
     * @param cargo <Atoms> //primary cargo is last atom
     */
    async _append(prev, next, tether, req, cargo, preSignHook = () => {}, rigging, { noHoist } = {} ) {
        if (req) {
            // TODO: _potentially_ re-introduce check to ensure we control this key?

            // At the moment assumes req is a RequirementSatisfier... a bit brittle.
            next.setKeyRequirement(req.constructor.requirementTypeHash,
                                   await req.exportPublicKey());
        }

        if (cargo) {
            next.setCargo(cargo);
        }
        if (tether) {
            next.setTetherHash(tether);
            this._setShield(next);

            // XXX(acg): This will fail if we cannot retrieve the hoist.
            await this._setPost(next);
        }

        if (rigging) {
            next.setRiggingPacket(rigging);
        }

        // Setter fn to perform any field modifications before signing and hoisting
        preSignHook(next);

        await this.satisfyRequirements(next);
        await this.inv.put(next.serialize());

        const nextTwist = next.twist();
        const lastFast = nextTwist.lastFast();
        if (tether && !tether.isNull() && lastFast && !noHoist) {
            // TODO(acg): ensure this is FIRMLY written before hoisting.
            try {
                let r = this.getRelay(lastFast);
                if (!r) {
                    //or do we warn..?
                    throw new Error("Cannot find relay for " + lastFast.getHash().toString());
                }
                let nth = nextTwist.getHash();
                await r.hoist(lastFast, nth);

                // FIXME(acg): Clean up this logic.  Works for basic cases for now
                if (r.hash || this.defaultTopLineHash) {
                    await this.pull(nextTwist, r.hash || this.defaultTopLineHash);
                }

            } catch(e) {
                console.error("Hoist error:", e);
                throw(e);
            }
        }
        return nextTwist;
    }

    /** Satisfies any requirements that can be satisfied on the specified file
     * @param tb <TwistBuilder> The twist builder that needs satisfactions
     * @returns <Promise>
     */
    async satisfyRequirements(tb) {
        let prev = tb.prev();
        if (prev && prev.reqs()) {
            // REVIEW(acg): policy on multi-reqs?
            // NOTE(cs): I have no idea what is going on here.
            for (let [reqTypeHash, reqPacketHash] of
                 Array.from(prev.reqs().getShapedValue().entries())) { //eew
                for (let satisfier of this.requirementSatisfiers) {
                    if (await satisfier.isSatisfiable(reqTypeHash, prev.get(reqPacketHash))) {
                        await tb.satisfy(satisfier);
                        return;
                    }
                }
            }
            throw new CannotSatisfyError();
        }
    }

    /**
     * Given a path retrieves the latest atoms from the tethered up to the specified poptop and
     * @param twist <Twist> The twist whose proof to get more of
     * @param poptop <Hash> The poptop hash
     * MUTATES ATOMS LIST INSIDE TWIST
     *
     * FIXME(acg): This isn't very smart. It assumes the last fast twist is
     * tethered to the same thing as everythign along the line. Any given
     * "level" may need to contact multiple relays.
     *
     */
    async pull(twist, poptopHash) {
        // TODO(acg): investigate what happens if the last twist isn't fast
        let lastFast = twist.lastFast();
        if (!lastFast) {
            return;
        }
        console.log("Pulling hitch for", lastFast.getHash().toString());
        let relay = this.getRelay(lastFast);
        let relayTwist = twist;

        while (relay) {
            let startHash = relayTwist.findLastStoredTetherHash();
            let upstream = await relay.get(startHash);
            twist.safeAddAtoms(upstream.getAtoms());
            relayTwist = new Twist(twist.getAtoms(), upstream.getHash());

            if (relayTwist.findPrevious(poptopHash)) {
                break;
            }
            let line = Line.fromAtoms(twist.getAtoms(), relayTwist.getHash());

            // TODO(acg): prevent infinite looping if we mess up the poptop
            relay = this.getRelay(line.twist(line.latestTwist()));
        }
        // TODO: should this auto-save?
        // yes
        await this.inv.put(twist.getAtoms());
    }

    async isCanonical(twist, popTopHash) {
        //XXX(acg): assumes current twist is fast.  assumes we can't have anything loose.

        let line = Line.fromTwist(twist);
        if (line.lastFastBeforeHash(twist.getHash())) {

            //FIXME(acg): This is potentially *highly* redundant: we don't
            //necessarily want to be doing this every time.
            let i = new Interpreter(line, popTopHash);
            try {
                await i.verifyHitchLine(twist.getHash());
            } catch (e) {
                console.error(e);
                throw e;
            }
        }
    }

    /** Verifies whether this twist or its tethers are controllable with our stuff
     * @param twist <Twist> the twist to verify control over.
     * @returns <Promise<Boolean>> a promise that is resolved if the twist's requirements can be met.
     */
    async isSatisfiable(twist) {
        //TODO: multi-reqs...
        if (twist.reqs()) {
            for (let [reqTypeHash, reqPacketHash] of
                 Array.from(twist.reqs().getShapedValue().entries())) { //eew
                for (let satisfier of this.requirementSatisfiers) {
                    let reqPacket = twist.get(reqPacketHash);
                    if (!await satisfier.isSatisfiable(reqTypeHash, reqPacket)) {
                        return false;
                    }
                }
            }
        } else {
            if (twist.isTethered()) {
                let tether = this.getFromAtomsOrInventory(twist.getAtoms(), twist.getTetherHash());
                if (tether) {
                    return this.isSatisfiable(tether);
                }
                return false;
            }
        }
        return true;
    }

    listLatest() {
        return this.inv.listLatest();
    }
}

class TodaClientError extends Error {}
class WaitForHitchError extends TodaClientError {}
class CannotSatisfyError extends TodaClientError {}

exports.TodaClient = TodaClient;
exports.WaitForHitchError = WaitForHitchError;
exports.CannotSatisfyError = CannotSatisfyError;
