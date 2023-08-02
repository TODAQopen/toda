/*************************************************************
 * TODAQ Open: TODA File Implementation
 * Toronto 2022
 *
 * Apache License 2.0
 *************************************************************/

//const { keysPaired, SignatureRequirement } = require("../core/reqsat");
import { ByteArray } from '../core/byte-array.js';
import { LocalRelayClient, RemoteNextRelayClient, RemoteRelayClient, LocalNextRelayClient } from './relay.js';
import { Hash, Sha256, NullHash } from '../core/hash.js';
import { ArbitraryPacket } from '../core/packet.js';
import { TwistBuilder, Twist, MissingPrevError } from '../core/twist.js';
import { Interpreter } from '../core/interpret.js';
import { Line } from '../core/line.js';
import { Abject } from "../../src/abject/abject.js";
import { DQ } from "../../src/abject/quantity.js";
import fs from 'fs-extra';

class TodaClient {

    constructor(inventory) {

        this.inv = inventory;

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

        this.dq = {balances: {},
                   balanceForceRecalc: {},
                   balanceCalculating: {},
                   quantities: {}};
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

    _getRelay(fastTwist, tetherUrl) {
        console.log("getting relay for:", fastTwist.getHash().toString(), "tethered to:",
                                          fastTwist.getTetherHash().toString());
        if (tetherUrl) {
            return new RemoteRelayClient(tetherUrl);
        }
        if (this.get(fastTwist.getTetherHash())) {
            return new LocalRelayClient(this, fastTwist.getTetherHash());
        }
        return this._defaultRelay(fastTwist);
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
        let tetherUrl;
        try {
            let abj = Abject.fromTwist(twist);
            tetherUrl = abj?.tetherUrl?.();
        } catch (e) {}
        return this._getRelay(twist, tetherUrl);
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

    async _waitForHoist(lead, relay) {
        let attempts = 0;
        while (attempts < this.retryTimes) {
            attempts++;
            let hoist = await relay.getHoist(lead);
            if (hoist) {
                return hoist;
            } else {
                console.warn("Requerying for hoist...");
                await new Promise(res => setTimeout(res, this.retryInterval));
            }
        }
        throw new WaitForHitchError();
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

            let hoist = await this._waitForHoist(lead, relay);
            tb.addRigging(lead.getHash(), hoist.getHash());
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
            // Attempts to bump the tether to the latest in its line using local data
            tether = Line.fromAtoms(next.getAtoms(), tether).latestTwist();

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

                await this._waitForHoist(lastFast, r);

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
            let startHash;
            try {
                startHash = relayTwist.findLastStoredTetherHash();
            } catch (err) {
                if (!err instanceof MissingPrevError)
                    throw err;
            }
            let upstream = await relay.get(startHash);
            twist.safeAddAtoms(upstream.getAtoms());
            relayTwist = new Twist(twist.getAtoms(), upstream.getHash());

            try {
                if (relayTwist.findPrevious(poptopHash))
                    break;
            } catch (err) {
                if (!err instanceof MissingPrevError)
                    throw err;
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
                await i.verifyTopline();
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
                    if (!(await satisfier.isSatisfiable(reqTypeHash, reqPacket))) {
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

    getQuantity(dq) {
        let h = dq.getHash();
        if (!this.dq.quantities[h]) {
            this.dq.quantities[h] = dq.quantity;
        }
        return this.dq.quantities[h];
    }

    getCombinedQuantity(dqs) {
        return dqs.reduce((v, dq) => v + this.getQuantity(dq), 0);
    }

    async getBalance(typeHash, forceRecalculate) {

        if (!forceRecalculate && this.dq.balances[typeHash]) {
            return {...this.dq.balances[typeHash],
                    recalculating: this.isCalculating(typeHash)};
        }
        if (forceRecalculate && this.isCalculating(typeHash)) {
            //"queue" it:
            this.dq.balanceForceRecalc[typeHash] = true;
            return;
        }

        this.dq.balanceCalculating[typeHash] = true;
        this.dq.balanceForceRecalc[typeHash] = false;

        this.dq.balances[typeHash] = await this._calculateBalance(typeHash);

        this.dq.balanceCalculating[typeHash] = false;
        if (this.dq.balanceForceRecalc[typeHash]) {
            // check if there was an import/spend while we were busy.
            this.getBalance(typeHash, true);
        }
        return {...this.dq.balances[typeHash], recalculating: this.isCalculating(typeHash)};
    }

    isCalculating(typeHash) {
        return this.dq.balanceCalculating[typeHash];
    }

    async listLatestControlledAbjects() {
        let abjs = [];
        for (let hash of this.listLatest()) {
            let twist = this.get(hash);
            if (await this.isSatisfiable(twist)) {
                abjs.push(Abject.fromTwist(twist));
            }
        }
        return abjs;
    }

    getControlledByType(typeHash) {
        let pred = function(abj) {
            if (abj && abj.rootId) {
                try {
                    return abj.rootId().equals(typeHash);
                } catch (e) {
                    //hack acg - avoid crash on broekn abjcect
                    return false;
                }
            }
        };
        return this.listLatestControlledAbjects().then(lca => lca.filter(pred));
    }

    async _calculateBalance(typeHash) {
        const files = await this.getControlledByType(typeHash);
        const qty = this.getCombinedQuantity(files);
        const value = files.length == 0 ? 0 : DQ.quantityToDisplay(qty, files[0].displayPrecision);
        return { balance: value,
                 quantity: qty,
                 type: typeHash.toString(),
                 files: files.map(f => f.getHash().toString()) };
        // this formatting seems more like something server.js should deal with
    }

    /**
     * @param {DQ} dq
     * @param {Number} quantity
     * @returns {Promise<Array>} [delegatedTwist, remainingTwist]
     */
    async delegateQuantity(dq, quantity) {

        // XXX(acg): PERF - some of these can happen locally without hoisting
        // all the way to poptop.

        // TODO(acg): There's a really weird amount of back-forth between Abj and
        // Twist we need to sort out.

        let dqTwist = new Twist(dq.serialize());
        if (!await this.isSatisfiable(dqTwist)) {
            throw new Error("Cannot delegate; cannot satisfy dqTwist");
        }

        let dqTether = dqTwist.getTetherHash();

        // create delegate
        let dqDel = dq.delegate(quantity);
        let dqDelTwist = await this._append(null, dqDel.buildTwist(), dqTether);
        // PERF(acg): does the above even need to be fast?

        // Append to delegator for CONFIRM
        let dqNext = dq.createSuccessor();
        dqNext.confirmDelegate(Abject.fromTwist(dqDelTwist));
        let dqNextTwist = await this._append(dqTwist, dqNext.buildTwist(), dqTether);

        // Append to delegate for COMPLETE
        let dqDelNext = Abject.fromTwist(dqDelTwist).createSuccessor();
        dqDelNext.completeDelegate(Abject.fromTwist(dqNextTwist));
        let dqDelNextTwist = await this._append(dqDelTwist, dqDelNext.buildTwist(), dqTether);

        return [dqDelNextTwist, dqNextTwist];
    }

    delegateValue(dq, value) {
        const qty = DQ.displayToQuantity(value, dq.displayPrecision);
        return this.delegateQuantity(dq, qty);
    }

    async _transfer(typeHash, twists, destHash) {
        let newTwists = [];
        for (let t of twists) {
            newTwists.push(await this._append(t, Abject.fromTwist(t).createSuccessor().buildTwist(), destHash));
        }

        //TODO(acg): potentially wait for the balance to actually be recalculated.
        this.getBalance(typeHash, true);
        return newTwists;
    }

    async transfer({ amount, typeHash, destHash }) {
        let dqs = await this.getControlledByType(typeHash);

        const quantity = DQ.displayToQuantity(amount, dqs[0].displayPrecision);

        let exact = dqs.find(dq => this.getQuantity(dq) == quantity);
        if (exact) {
            return this._transfer(typeHash, [exact], destHash);
        }
        let excess = dqs.find(dq => this.getQuantity(dq) > quantity);
        if (excess) {
            let [delegated, _] = await this.delegateQuantity(excess, quantity);
            return this._transfer(typeHash, [delegated], destHash);
        }

        let selected = [];
        let cv = 0;
        for (let dq of dqs) { // select bills until we collect just what we need or a bit more
            if (cv >= quantity) break;
            selected.push(dq);
            cv = this.getCombinedQuantity(selected);
        }
        if (cv > quantity) { // if more than what we need, frac the last one
            // XXX(acg): we could be smarter about which to frac
            let lastBill = selected.pop();
            let [_, delegator] = await this.delegateQuantity(lastBill, cv - quantity);
            selected.push(delegator);
        }
        if (cv >= quantity)
        {
            return this._transfer(typeHash, selected, destHash);
        }
        throw new Error("Insufficient funds");
    }
}

class TodaClientV2 extends TodaClient {
    constructor(inventory, fileServerUrl) {
        super(inventory);
        this.fileServerUrl = fileServerUrl;
        this.retryTimes = 5;
        this.retryInterval = 1000;
    }

    _backwardsStopPredicate(fastTwist) {   
        /* For the sake of performance, there are 3 conditions where we want to stop moving backwards when pulling the relay:
            1) when we reach a fast twist
            2) when we reach a twist that is known to be the `topline hash` (by definition we do not need any 
                information prior to this point, assuming the abject is properly defined)
            3) when we know that the relay line portion we have is loose, we do not want to walk all the way 
                back looking for the topline hash or a fast twist. Instead, we can stop whenever we see a twist 
                that has already been gathered in a previous pull. So we: 
                    a) we locally check whether or not the relay line is loose; then 
                    b) if it is, locally find the most recent twist we know about on that line; then 
                    c) walk back until we see that twist
        */
        let lastKnownRelayTwist;
        let relayLineIsFast;
        try { 
            lastKnownRelayTwist = fastTwist.tether() ?? fastTwist.findLastStoredTether();
            relayLineIsFast = lastKnownRelayTwist?.lastFast();
        } catch (err) {
            // MissingPrevError is acceptable: we don't expect a relay line
            //  to contain all twists. If it reaches a missing twist, we can
            //  safely treat the line as 'loose'
            if (!err instanceof MissingPrevError)
                throw err;
        }
        return (backwardsTwist) => {
            const isFast = backwardsTwist.isTethered();
            const isTopLine = this.defaultTopLineHash && this.defaultTopLineHash.equals(backwardsTwist.getHash());
            const isKnownLoose = !relayLineIsFast && lastKnownRelayTwist?.getHash().equals(backwardsTwist.getHash());
            return isFast || isTopLine || isKnownLoose;
        };
    }

    _defaultRelay(fastTwist) {
        if (this.defaultRelayUrl) {
            console.log("returning default relay url:", this.defaultRelayUrl);
            return new RemoteNextRelayClient(this.defaultRelayUrl, this.fileServerUrl, fastTwist.getTetherHash(), this._backwardsStopPredicate(fastTwist));
        }
        console.error("No default relay found.");
        return null;
    }

    _getRelay(fastTwist, tetherUrl) {
        console.log("getting relay for:", fastTwist.getHash().toString(), "tethered to:",
                                          fastTwist.getTetherHash().toString());
        if (tetherUrl) {
            return new RemoteNextRelayClient(tetherUrl, this.fileServerUrl, fastTwist.getTetherHash(), this._backwardsStopPredicate(fastTwist));
        }
        if (this.get(fastTwist.getTetherHash())) {
            return new LocalNextRelayClient(this, fastTwist.getTetherHash());
        }
        return this._defaultRelay(fastTwist);
    }

    getRelayFromString() {
        throw new Error("Not implemented; use getRelay instead");
    }

    async _setPost(tb) {
        const lead = tb.twist().lastFast()?.lastFast();
        if (lead) {
            // temporary hackitty hack
            // does this twist already contain the hoisting info?
            let local = new LocalNextRelayClient(this, lead.getTetherHash());
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

            let hoist = await this._waitForHoist(lead, relay);
            tb.addRigging(lead.getHash(), hoist.getHash());
        }
        //TODO(acg): why wouldn't we also not take advantage of having grabbed
        //all those proof atoms and save em?
    }
}

class TodaClientError extends Error {}
class WaitForHitchError extends TodaClientError {}
class CannotSatisfyError extends TodaClientError {}

export { TodaClient,
         TodaClientV2,
         WaitForHitchError,
         CannotSatisfyError };
