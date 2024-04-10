/*************************************************************
 * TODAQ Open: TODA File Implementation
 * Toronto 2022
 *
 * Apache License 2.0
 *************************************************************/

//const { keysPaired, SignatureRequirement } = require("../core/reqsat");
import { LocalRelayClient, RemoteRelayClient } from './relay.js';
import { Sha256, NullHash } from '../core/hash.js';
import { ArbitraryPacket } from '../core/packet.js';
import { TwistBuilder, Twist, MissingPrevError, MissingHashPacketError }
    from '../core/twist.js';
import { byteConcat } from '../core/byteUtil.js';
import { Interpreter } from '../core/interpret.js';
import { Line } from '../core/line.js';
import { NamedError } from '../core/error.js';
import { Abject } from "../../src/abject/abject.js";
import { DQ } from "../../src/abject/quantity.js";
import fs from 'fs-extra';
import { P1String } from '../abject/primitive.js';
import { LocalInventoryClient } from './inventory.js';

class TodaClient {
    constructor(inventory, fileServerUrl) {

        /**
         * @type {LocalInventoryClient}
         */
        this.inv = inventory;

        /** Use this default for evaluating non-abjects
         * when no top is specified. */
        /** Also use this default when creating
         * new abjects when no top is specified. */
        this.defaultTopLine = "https://slow.line.todaq.net";
        this.defaultTopLineHash = null;

        this.defaultRelayHash = null;
        this.defaultRelayUrl = null;
        this.shieldSalt = "~/.toda/.salt";

        this.requirementSatisfiers = [];

        this.appendLocks = {};

        this.fileServerUrl = fileServerUrl;
        this.retryTimes = 5;
        this.retryInterval = 1000;

        this.shouldArchiveUnownedFiles = true;
    }

    async populateInventory() {
        await this.inv.populate();
    }

    addSatisfier(rs) {
        this.requirementSatisfiers.push(rs);
    }

    async archiveUnownedFiles() {
        const hs = this.inv.listLatest();
        for(const h of hs) {
            const twist = new Twist(await this.inv.get(h));
            if(!await this.isSatisfiable(twist)) {
                this.inv.unown(twist.getHash());
            }
        }
    }

    _backwardsStopPredicate(fastTwist) {
        //FIXME: a) this could be cleaned up
        //       b) we need to be able to specify the poptopHash rather
        //          than use the default; e.g. in pull(), we have a specified
        //          poptop, which should be what we use here
        /* For the sake of performance, there are 3 conditions where we
            want to stop moving backwards when pulling the relay:
            1) when we reach a fast twist
            2) when we reach a twist that is known to be the `topline hash`
                (by definition we do not need any
                information prior to this point, assuming the abject is
                properly defined)
            3) when we know that the relay line portion we have is loose,
                we do not want to walk all the way
                back looking for the topline hash or a fast twist. Instead,
                we can stop whenever we see a twist
                that has already been gathered in a previous pull. So we:
                    a) we locally check whether or not the relay line is
                        loose; then
                    b) if it is, locally find the most recent twist we
                        know about on that line; then
                    c) walk back until we see that twist
        */
        let lastKnownRelayTwist;
        let relayLineIsFast;
        try {
            lastKnownRelayTwist = fastTwist.tether() ??
                                  fastTwist.findLastStoredTether();
            relayLineIsFast = lastKnownRelayTwist?.lastFast();
        } catch (err) {
            // MissingPrevError is acceptable: we don't expect a relay line
            //  to contain all twists. If it reaches a missing twist, we can
            //  safely treat the line as 'loose'
            // MissingHashPacketError is also acceptable; if the tether
            //  is missing
            if (!(err instanceof MissingPrevError) &&
                !(err instanceof MissingHashPacketError)) {
                throw err;
            }
        }
        return (backwardsTwist) => {
            const isFast = backwardsTwist.isTethered();
            const isTopLine = this.defaultTopLineHash &&
                this.defaultTopLineHash.equals(backwardsTwist.getHash());
            const isKnownLoose = !relayLineIsFast &&
                lastKnownRelayTwist?.getHash().equals(backwardsTwist.getHash());
            return isFast || isTopLine || isKnownLoose;
        };
    }

    _defaultRelay(fastTwist) {
        if (this.defaultRelayUrl) {
            return new RemoteRelayClient(this.defaultRelayUrl,
                    this.fileServerUrl,
                    fastTwist.getTetherHash(),
                    this._backwardsStopPredicate(fastTwist),
                    this.defaultTopLineHash);
        }
        console.error("No default relay found.");
        return null;
    }

    _getRelay(fastTwist, tetherUrl) {
        if (tetherUrl) {
            return new RemoteRelayClient(tetherUrl,
                this.fileServerUrl,
                fastTwist.getTetherHash(),
                this._backwardsStopPredicate(fastTwist),
                this.defaultTopLineHash);
        }
        if (this.inv.contains(fastTwist.getTetherHash())) {
            return new LocalRelayClient(this,
                fastTwist.getTetherHash(),
                this._backwardsStopPredicate(fastTwist),
                this.defaultTopLineHash);
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
        } catch (e) {
            // not an abj; ergo tether url is null
        }
        return this._getRelay(twist, tetherUrl);
    }

    // typically used for looking up tethers, where we don't know if the proof
    // is in this file or another.
    async getFromAtomsOrInventory(atoms, hash) {
        if (atoms.get(hash)) {
            return new Twist(atoms, hash);
        }
        return await this.get(hash);
    }

    latestHash(hash) {
        return this.inv.findLatest(hash);
    }

    async get(hash) {
        let atoms = await this.inv.get(hash);
        if (atoms) {
            return new Twist(atoms);
        }
        return null;
    }

    clearInMemoryCache() {
        this.inv.clearInMemoryCache();
    }

    //TODO: remove?
    async getExplicitPath(path) {
        // assumes current inv is a LocalInventoryClient
        return new Twist(await this.inv.getExplicitPath(path));
    }

    _shouldShield(tb) {
        // Heuristic.
        // If the tether does not appear to be local, we add a shield.
        return !this.inv.contains(tb.getTetherHash());
    }

    _getSalt() {
        return new Uint8Array(fs.readFileSync(this.shieldSalt));
    }

    _generateShield(hash) {
        hash = hash || new NullHash();
        return Sha256.hash(byteConcat(this._getSalt(),
                                                    hash.toBytes()));
    }

    // TODO: support explicit shields later.  only salted ones for now.
    _setShield(tb) {
        if (this._shouldShield(tb)) {
            tb.setShield(new ArbitraryPacket(
                this._generateShield(tb.getPrevHash())));
            // xxx(acg): perhaps have twistbuilder create the packet
        } else {
            //console.log("NOT setting shield.");
        }
    }

    async _waitForHoist(lead, relay) {
        let attempts = 0;
        while (attempts < this.retryTimes) {
            attempts++;
            let {hoist, relayTwist} = await relay.getHoist(lead);
            if (hoist) {
                return {hoist, relayTwist};
            } else {
                await new Promise(res => setTimeout(res, this.retryInterval));
            }
        }
        throw new WaitForHitchError();
    }

    async _getHoistFromLocal(lead) {
         // Check if this twist already contains the hoist
         const i = new Interpreter(Line.fromTwist(lead));
         try {
             return i.hitchHoist(lead.getHash());
         } catch {
            return null;
         }
    }

    async _getHoistFromRelay(lead, meetHash) {
        const relay = this.getRelay(lead);
        if (!relay) {
            console.error("NO RELAY FOUND FOR:", lead.getHash().toString());
            throw new WaitForHitchError(); //TODO: specialize this error
        }
        // Rehoist; in case we missed hoisting earlier
        const hoist = (await relay.getHoist(lead)).hoist;
        if (hoist) {
            return hoist;
        }
        console.warn("Expected to find a hoist but couldn't; rehoisting");
        await relay.hoist(lead, meetHash);
        return (await this._waitForHoist(lead, relay)).hoist;
    }

    async _setPost(tb) {
        const meet = tb.twist().lastFast();
        const lead = meet?.lastFast();
        if (lead) {
            const hoist = (await this._getHoistFromLocal(lead)) ??
                          (await this._getHoistFromRelay(lead, meet.getHash()));
            tb.addRigging(lead.getHash(), hoist.getHash());
        }
    }

    create(tether, req, cargo, opts) {
        return this._append(null, new TwistBuilder(),
            tether, req, cargo, undefined, undefined, opts);
    }

    /**
     * @param prev <Twist>
     * @param tether <Hash>
     * @param req
     * @param cargo <Atoms> //primary cargo is last atom
     */
    append(prev, tether, req, cargo, preSignHook, rigging, opts) {
        // TODO(acg): re-introduce already-existing successor check here.

        return this._append(prev, prev.createSuccessor(),
            tether, req, cargo, preSignHook, rigging, opts);
    }

    /**
     * @param twistBuilder <TwistBuilder> the twist to build
     * @param tetherHash <Hash>
     * @param req <Requirement> the requirements to use
     */
    finalizeTwist(twistBuilder, tetherHash, req, opts) {
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
    async _append(prev, next, tether, req, cargo,
                  preSignHook = () => {}, rigging,
                  { noHoist, noRemote, popTop } = {} ) {
        if (req) {
            // TODO: _potentially_ re-introduce check to ensure we control
            //  this key?
            //  At the moment assumes req is a
            //  RequirementSatisfier... a bit brittle.
            next.setKeyRequirement(req.constructor.requirementTypeHash,
                                   await req.exportPublicKey());
        }

        if (cargo) {
            next.setCargo(cargo);
        }
        if (tether) {
            // Attempts to bump the tether to the latest in
            //  its line using local data
            tether = Line.fromAtoms(next.getAtoms(), tether).latestTwist();

            next.setTetherHash(tether);
            this._setShield(next);

            // XXX(acg): This will fail if we cannot retrieve the hoist.
            await this._setPost(next);
        }

        if (rigging) {
            next.setRiggingPacket(rigging);
        }

        // Setter fn to perform any field
        // modifications before signing and hoisting
        preSignHook(next);
        await this.satisfyRequirements(next);
        const nextTwist = next.twist();
        await this.put(nextTwist);

        const lastFast = nextTwist.lastFast();
        if (tether && !tether.isNull() && lastFast && !noHoist) {
            // TODO(acg): ensure this is FIRMLY written before hoisting.
            try {
                let r = this.getRelay(lastFast);
                if (!r) {
                    //or do we warn..?
                    throw new Error("Cannot find relay for " +
                        lastFast.getHash().toString());
                }
                let nth = nextTwist.getHash();
                await r.hoist(lastFast, nth, { noFast: noRemote });
                await this._waitForHoist(lastFast, r);
                const pullUntil = popTop ??
                              this.defaultTopLineHash ??
                              tether;
                await this.pull(nextTwist, pullUntil);
            } catch (e) {
                console.warn("Hoist error:", e);
                //We don't need to throw here; it can be rehoisted later
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
                    if (await satisfier.isSatisfiable(reqTypeHash,
                            prev.get(reqPacketHash))) {
                        await tb.satisfy(satisfier);
                        return;
                    }
                }
            }
            throw new CannotSatisfyError();
        }
    }

    /**
     * Given a path retrieves the latest atoms from the tethered
     *  up to the specified poptop and
     * MUTATES ATOMS LIST INSIDE TWIST
     * Optionally takes the result of a previous get of the same
     *  twist to make fewer remote calls
     * @param twist <Twist> The twist whose proof to get more of
     * @param poptop <Hash> The poptop hash
     * @param previousGetResult <Twist> Optional. An optimization.
     *     A twist from relay.get with the same startHash. If not
     *     provided, it'll make an additional relay.get
     *
     * FIXME(acg): This isn't very smart. It assumes the last fast twist is
     * tethered to the same thing as everythign along the line. Any given
     * "level" may need to contact multiple relays.
     *
     */
    async pull(twist, poptopHash, previousGetResult) {
        // TODO(acg): investigate what happens if the last twist isn't fast
        let lastFast = twist.lastFast();
        if (!lastFast) {
            return;
        }
        let relay = this.getRelay(lastFast);

        while (relay) {
            let startTwist, startHash;
            try {
                startTwist = twist.findLastStoredTether();
                startHash = startTwist?.getHash();
            } catch (err) {
                if (!(err instanceof MissingPrevError)) {
                    throw err;
                }
            }

            if (startTwist?.isTethered()) {
                await relay.populateShield?.(startTwist);
                twist.addAtoms(startTwist.getAtoms());
            }
            let prevFastTwist;
            try {
                prevFastTwist = startTwist?.lastFast();
            } catch (e) {
                // There might not be a prev
                if (!(e instanceof MissingPrevError)) {
                    throw e;
                }
            }
            if (prevFastTwist) {
                await relay.populateShield?.(prevFastTwist);
                twist.addAtoms(prevFastTwist.getAtoms());
            }

            let upstream = await relay.get(startHash);
            twist.addAtoms(upstream.getAtoms());
            let relayTwist = new Twist(twist.getAtoms(), relay.tetherHash);
            const relayLine = Line.fromTwist(relayTwist);

            try {
                if (relayLine.colinear(relayTwist.getHash(), poptopHash)) {
                    break;
                }
            } catch (err) {
                if (!(err instanceof MissingPrevError)) {
                    throw err;
                }
            }

            // TODO(acg): prevent infinite looping if we mess up the poptop
            relay = this.getRelay(relayTwist);
        }
        // TODO: should this auto-save?
        // yes
        await this.put(twist);
    }

    async put(twist) {
        await this.inv.put(twist.getAtoms());
        if (this.shouldArchiveUnownedFiles &&
            !await this.isSatisfiable(twist)) {
            this.inv.unown(twist.getHash());
        }
    }

    async isCanonical(twist, popTopHash) {
        //XXX(acg): assumes current twist is fast.
        //  assumes we can't have anything loose.

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

    /** Verifies whether this twist or its
     *  tethers are controllable with our stuff
     * @param twist <Twist> the twist to verify control over.
     * @returns <Promise<Boolean>> a promise that
     *  is resolved if the twist's requirements can be met.
     */
    async isSatisfiable(twist) {
        //TODO: multi-reqs...
        if (twist.reqs()) {
            for (let [reqTypeHash, reqPacketHash] of
                 Array.from(twist.reqs().getShapedValue().entries())) { //eew
                let satisfied = false;
                for (let satisfier of this.requirementSatisfiers) {
                    let reqPacket = twist.get(reqPacketHash);
                    if (await satisfier.isSatisfiable(
                            reqTypeHash, reqPacket)) {
                        satisfied = true;
                        break;
                    }
                }
                if (!satisfied) return false;
            }
            return true;
        } else {
            if (twist.isTethered()) {
                let tether = await this.getFromAtomsOrInventory(
                    twist.getAtoms(), twist.getTetherHash());
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

    //TODO: remove!
    getQuantity(dq) {
        return this.inv.dqCache.getQuantity(dq.getHash());
    }

    //TODO: remove!
    getCombinedQuantity(dqs) {
        return dqs.reduce((v, dq) => v + this.getQuantity(dq), 0);
    }

    getBalance(typeHash) {
        let balance = this.inv.dqCache.getBalance(typeHash);
        if (!balance) {
            balance = { totalDisplay: 0,
                        totalQuantity: 0,
                        displayPrecision: null,
                        poptop: null,
                        fileQuantities: {}};
        }
        const { totalDisplay,
                totalQuantity,
                displayPrecision,
                poptop,
                fileQuantities } = balance;
        return { balance: totalDisplay,
                 quantity: totalQuantity,
                 type: typeHash.toString(),
                 displayPrecision,
                 poptop,
                 files: Object.keys(fileQuantities).map(h => h.toString()),
                 fileQuantities,
                 recalculating: false };
        // this formatting seems more like something server.js should deal with
    }

    getBalanceAll() {
        const r = {};
        for (const h of this.inv.dqCache.listAll()) {
            const root = this.inv.dqCache.getRootId(h);
            if (!r[root]) {
                r[root] = this.getBalance(root);
            }
        }
        return r;
    }

    isCalculating() {
        return false;
    }

    //XXX: EXPENSIVE!!!! Remove!!!
    async listLatestControlledAbjects() {
        let abjs = [];
        for (let hash of this.listLatest()) {
            let twist = await this.get(hash);
            if (await this.isSatisfiable(twist)) {
                abjs.push(Abject.fromTwist(twist));
            }
        }
        return abjs;
    }

    //XXX: EXPENSIVE!!!! Remove!!!
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
            return false;
        };
        return this.listLatestControlledAbjects().then(lca => lca.filter(pred));
    }

    /**
     * @param {DQ} dq
     * @param {Number} quantity
     * @returns {Promise<Array>} [delegatedTwist, remainingTwist]
     */
    async delegateQuantity(dq, quantity, { lastFast } = {}) {

        // TODO(acg): There's a really weird
        // amount of back-forth between Abj and
        // Twist we need to sort out.

        let dqTwist = new Twist(dq.serialize());
        const popTop = dq.popTop();

        if (!await this.isSatisfiable(dqTwist)) {
            throw new CannotSatisfyError("Cannot delegate; cannot satisfy dqTwist");
        }

        let dqTether = dqTwist.isTethered() ?
                       dqTwist.getTetherHash() :
                       dqTwist.lastFast()?.getTetherHash();

        // create delegate
        let dqDel = dq.delegate(quantity);
        let dqDelTwist = await this._append(null, dqDel.buildTwist(), dqTether,
                                            null, null, undefined, null,
                                            { noRemote: true, popTop });

        // Append to delegator for CONFIRM
        let dqNext = dq.createSuccessor();
        dqNext.confirmDelegate(Abject.fromTwist(dqDelTwist));
        let dqNextTwist = await this._append(dqTwist, dqNext.buildTwist(),
                                             dqTether, null, null, undefined,
                                             null, { noRemote: true, popTop });

        // Append to delegate for COMPLETE
        let dqDelNext = Abject.fromTwist(dqDelTwist).createSuccessor();
        dqDelNext.completeDelegate(Abject.fromTwist(dqNextTwist));
        let dqDelNextTwist = await this._append(dqDelTwist,
                                                dqDelNext.buildTwist(),
                                                dqTether,
                                                null, null, undefined, null,
                                                { noRemote: !lastFast,
                                                  popTop });

        return [dqDelNextTwist, dqNextTwist];
    }

    delegateValue(dq, value) {
        const qty = DQ.displayToQuantity(value, dq.displayPrecision);
        return this.delegateQuantity(dq, qty);
    }

    async _transfer(typeHash, twists, destHash, popTop) {
        let newTwists = [];
        for (let [i,t] of twists.entries()) {
            const successorAbj = Abject.fromTwist(t).createSuccessor();
            const successor = await this._append(t, successorAbj.buildTwist(),
                                                 destHash, null, null,
                                                 undefined, null,
                                                 { popTop });
            newTwists.push(successor);
        }
        return newTwists;
    }

    async _getOwned(hash) {
        const atoms = await this.inv.getOwned(hash);
        return atoms ? new Twist(atoms) : null;
    }

    async transfer({ amount, typeHash, destHash }) {
        // XXX(acg): always fastens last twist for now
        const balance = this.getBalance(typeHash);

        if (!balance) {
            throw new Error("Insufficient funds");
        }

        const quantity = DQ.displayToQuantity(amount, balance.displayPrecision);

        if (quantity < balance.totalQuantity) {
            throw new Error("Insufficient funds");
        }

        const exact = Object.keys(balance.fileQuantities)
                            .find(h => balance.fileQuantities[h].quantity
                                         == quantity);

        if (exact) {
            const twist = await this._getOwned(exact);
            if (!twist) {
                console.warn("DQ Cache contradicted inv; rebuilding cache");
                await this.inv.rebuildDQCache();
                return await this.transfer({amount, typeHash, destHash});
            }
            return await this._transfer(typeHash,
                                        [twist],
                                        destHash,
                                        balance.poptop);
        }
        const excess = Object.keys(balance.fileQuantities)
                             .find(h => balance.fileQuantities[h].quantity
                                         > quantity);
        if (excess) {
            const twist = await this._getOwned(excess);
            if (!twist) {
                console.warn("DQ Cache contradicted inv; rebuilding cache");
                await this.inv.rebuildDQCache();
                return await this.transfer({amount, typeHash, destHash});
            }
            const dq = Abject.fromTwist(twist);
            let [delegated, _] = await this.delegateQuantity(dq,
                                                             quantity);
            return this._transfer(typeHash,
                                  [delegated],
                                  destHash,
                                  balance.poptop);
        }

        let selected = [];
        let cv = 0;
        // select bills until we collect just what we need or a bit more
        for (const h of Object.keys(balance.fileQuantities)) {
            if (cv >= quantity) {
                break;
            }
            const twist = await this._getOwned(h);
            if (!twist) {
                console.warn("DQ Cache contradicted inv; rebuilding cache");
                await this.inv.rebuildDQCache();
                return await this.transfer({amount, typeHash, destHash});
            }
            selected.push(twist);
            cv += balance.fileQuantities[h];
        }

        // if more than what we need, frac the last one
        // XXX(acg): we could be smarter about which to frac
        if (cv > quantity) {
            let lastBill = selected.pop();
            const dq = Abject.fromTwist(lastBill);
            let [_, delegator] =
                await this.delegateQuantity(dq, cv - quantity);
            selected.push(delegator);
        }

        if (cv >= quantity) {
            return this._transfer(typeHash, selected, destHash, balance.poptop);
        }

        throw new Error("Insufficient funds");
    }

    /**
     * @param {Hash || Null} tetherHash : default relay hash if null
     * @param {Int} quantity : must be positive
     * @param {Int || Null} precision : default 0
     * @param {String || Null} mintingInfo : string to put into
     *      the mintingInfo field of abject,
     *      if null does not populate the mintingInfo field
     * @param {Hash || Null} popTop : the hash to put into
     *      the poptop field; client's default if unspecified
     * @returns {Promise<{dq: Twist, root: Hash}>}
     */
    async mint(quantity, precision, tetherHash, popTop, mintingInfo) {
        tetherHash ||= this.defaultRelayHash;
        popTop ||= this.defaultTopLineHash;
        precision ||= 0;

        let mintingAbject;
        if (mintingInfo) {
            mintingAbject = new P1String(mintingInfo);
        }

        const dq = DQ.mint(quantity, precision, mintingAbject);

        // Note: If no popTop, the DQ is malformed (since it can never
        //       be supported)
        if (popTop) {
            dq.setPopTop(popTop);
        }
        const dqTwist = await this.finalizeTwist(dq.buildTwist(),
                                                 tetherHash);

        // HACK: This is a temporary solution for populating older poptops
        if (popTop) {
            const relay = new RemoteRelayClient(this.defaultRelayUrl,
                                                this.fileServerUrl,
                                                popTop,
                                                () => true);
            let prevToplineAtoms = (await relay.get()).getAtoms();
            dqTwist.addAtoms(prevToplineAtoms);
            this.put(dqTwist);
        }

        const dqNextTB = Abject.fromTwist(dqTwist)
                               .createSuccessor()
                               .buildTwist();

        dqNextTB.setPrev(dqTwist);
        const dqNextTwist = await this.finalizeTwist(dqNextTB,
                                                     dqTwist.getTetherHash());

        return {twist: dqNextTwist, root: dqTwist.getHash()};
    }
}

class TodaClientError extends NamedError {}
class WaitForHitchError extends TodaClientError {}
class CannotSatisfyError extends TodaClientError {}

export { TodaClient,
         WaitForHitchError,
         CannotSatisfyError };
