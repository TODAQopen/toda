/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import { Twist } from './twist.js';

import { Shield } from './shield.js';
import { RequirementSatisfier, ReqSatError } from './reqsat.js';

class InterpreterResult extends Error {
}

class MissingError extends InterpreterResult {

    constructor(missingHash, message) {
        super();
        this.missingHash = missingHash;
        this.message = message;
    }
}
class MissingEntryError extends InterpreterResult {
    constructor(trieHash, entryHash, message) {
        super();
        this.trieHash = trieHash;
        this.entryHash = entryHash;
        this.message = message;
    }
}

class LooseTwistError extends InterpreterResult {
    constructor(hash) {
        super();
        this.hash = hash;
    }
}
class MissingHoistError extends MissingError {}
class MissingPrevious extends MissingError {}
class MissingSuccessor extends MissingError {}
class MissingPostEntry extends MissingEntryError {}

class Interpreter {
    constructor(line, topHash) {
        this.line = line;
        this.topHash = topHash;
    }

    twist(hash) {
        return new Twist(this.line.getAtoms(), hash);
    }

    /**
     * @return <Twist>
     */
    next(hash) {
        let next = this.line.successor(hash);
        if (!next)
            return null;
        return this.twist(next);
    }

    /**
     * @return <Twist>
     */
    prev(hash) {
        if (hash?.isNull?.())
            return null;
        try {
            return this.twist(hash).prev();
        } catch (e) {
            throw new MissingPrevious(hash);
        }
    }

    isTopline(hash) {
        if (hash.equals(this.topHash)) {
            return true;
        }
        let prev;
        try
        {
            prev = this.prev(hash);
        }
        catch (err)
        {
            return false;
        }
        if (prev) {
            return this.isTopline(prev.hash);
        }
        return false;
    }

    async verifyTopline() {
        if (!this.line.get(this.topHash)) {
            throw new MissingError(this.topHash, "Missing topline hash");
        }
        let stop = this.line.last(this.topHash);
        if (!stop) {
            throw new MissingError(this.topHash, "Missing topline successor");
        }
        await this.verifyLegitSeg(this.topHash, stop);
    }

    /**
     * @param reqHash <Hash> the type of the requirement (e.g. secp...)
     * @param prevTw <Twist>
     * @param twist <Twist>
     */
    async verifyReqSat(reqHash, prevTw, twist) {
        let reqPacketHash = prevTw.reqs(reqHash);
        let keyPacket = prevTw.get(reqPacketHash);
        if (!keyPacket) {
            throw new MissingError(reqPacketHash, "missing requirement packet");
        }
        // TODO: verify shape
        let sigPacketHash = twist.sats(reqHash);
        if (!sigPacketHash) {
            throw new MissingEntryError(twist.hash, reqHash, "missing sig entry");
        }
        // TODO: verify shape
        let sigPacket = twist.get(sigPacketHash);
        if (!sigPacket) {
            throw new MissingError(sigPacketHash, "missing sig packet...");
        }

        if (!(await RequirementSatisfier.verifySatisfaction(reqHash, twist, keyPacket, sigPacket))) {
            throw new ReqSatError(reqHash, twist.packet.getBodyHash(), keyPacket, sigPacket);
        }
    }

    async verifyLegit(prevTw, twist) {
        if (prevTw.reqs() && twist.sats()) {
            let reqKeys = prevTw.reqs().getContainedKeyHashes();
            let satKeys = twist.sats().getContainedKeyHashes();
            if (reqKeys.length != satKeys.length) {
                throw new Error("req/sat trie key length mismatch");
            }
            return Promise.all(reqKeys.map(reqHash => {
                return this.verifyReqSat(reqHash, prevTw, twist);
            }));
        } else if (!(prevTw.reqs() || twist.sats())) {
            return; //why does js not have xor...
        } else {
            throw new Error("req/sat mismatch..."); //todo
        }
    }

    /**
     * @param hash <Hash>
     * @returns <Twist>
     */
    async legitNext(hash) {
        let next = this.next(hash);
        if (!next) {
            throw new MissingSuccessor(hash);
        }
        await this.verifyLegit(this.twist(hash), next);
        return next;
    }

    /**
     * @param start <Hash>
     * @param stop <Hash>
     * @throws everything
     */
    async verifyLegitSeg(start, stop) {
        // console.log("Checking legit seg:", start.toString(), stop.toString());
        let next = await this.legitNext(start);
        if (next.hash.equals(stop))
            return;
        return this.verifyLegitSeg(next.hash, stop);
    }

    inSegment(start,stop,search) {
        // console.log("In segment?",start.toString(),stop.toString(),search.toString());
        if (search.equals(stop)) {
            return true;
        }
        if (stop.equals(start) || stop.isNull()) {
            return false;
        }
        return this.inSegment(start, this.prev(stop).hash, search);
    }

    /**
     * @param hash <Hash>
     * @returns <Twist>
     */
    nextTetheredTwist(hash) {
        let twist = this.next(hash);
        if (!twist) {
            return null;
        }
        if (twist.isTethered()) {
            return twist;
        }
        return this.nextTetheredTwist(twist.hash);
    }

    /**
     * @return <Twist>
     */
    prevTetheredTwist(hash) {
        let prev = this.prev(hash);
        if (!prev)
            return null;

        if (prev.isTethered()) {
            return prev;
        }
        return this.prevTetheredTwist(prev.hash);
    }

    isHoist(lead, twist) {
        // dx: perf: hey, cache these values! this happens a lot and hashing is slow!
        let s = Shield.shield(lead.hash, lead.hash, lead.shield());
        let ss = Shield.doubleShield(lead.hash, lead.hash, lead.shield());
        let v = twist.rig(s);
        let vv = twist.rig(ss);

        return v && vv && !v.equals(s) && Shield.shield(lead.hash, v, lead.shield()).equals(vv);
    }

    hoistForwardSearch(lead, twist) {
        if (!twist) {
            return null;
        }
        if (this.isHoist(lead, twist)) {
            return twist;
        }
        return this.hoistForwardSearch(lead, this.next(twist.hash));
    }

    /**
     * Given a 'lead', returns a 'hoist' or null
     * @returns <Twist>
     */
    hitchHoist(leadHash) {
        let lead = this.twist(leadHash);
        return this.hoistForwardSearch(lead, this.next(lead.tether().hash));
    }

    /**
     * Given a 'lead', returns a 'meet'
     * @returns <Twist>
     */
    hitchMeet(hash) {
        let leadTwist = this.twist(hash);
        let hoist = this.hitchHoist(hash);

        if (!hoist) {
            throw new MissingHoistError(hash, undefined, {atoms: this.line.atoms.hashes});
        }

        let meet = this.twist(hoist.rig(Shield.shield(hash, hash, leadTwist.shield())));
        if (meet.isTethered()) {
            return meet;
        }
        throw new Error("Meet is not fast.");
    }

    /**
     * Given a 'lead' returns a 'post'
     * @returns <Twist>
     */
    hitchPost(hash) {
        let meet = this.hitchMeet(hash);
        let post = this.nextTetheredTwist(meet.hash);
        if (post) {
            let hoistHash = post.rig(hash);
            if (hoistHash) {
                if (hoistHash.equals(this.hitchHoist(hash).hash)) {
                    return post;
                }
                throw new Error("post rig entry conflict!"); //todo
            }
            throw new MissingPostEntry(post.hash, hash);
        }
        return null;
    }

    /**
     * Assumption: Topline is already verified
     * @return <Twist> meet
     */
    async verifyHitch(hash) {
        let meet = this.hitchMeet(hash);

        await this.verifyLegitSeg(hash, meet.hash);

        if (!(this.prevTetheredTwist(meet.hash).hash.equals(hash))) {
            throw new Error("...fPrev of meet wrong..."); //todo
        }

        // verify Tether to Hoist is supported:
        let hoist = this.hitchHoist(hash);

        if (this.isTopline(hoist.hash)) {
            return; // bueno
        }
        let presumedLead = this.prevTetheredTwist(hoist.hash);
        if (!presumedLead) {
            throw new LooseTwistError(hoist.hash);
        }
        await this._verifyHitchLine(presumedLead.hash,
            this.twist(hash).tether().hash,
            true);

        let post = this.hitchPost(hash);
        if (post) {
            // this might not actually be necessary
            await this.verifyLegitSeg(meet.hash, post.hash);
        }
        // console.log("Verified hitch from " + hash.toString() + " to " + meet.hash.toString());
        return meet;
    }

    isFullHitch(hash) {
        return !!this.hitchPost(hash);
    }

    /**
     * Given what MUST be the *lead* of a hitch, verifies thinngs are
     * bueno, and goes backward
     *
     * Stops at the hitch including optLastSupported, if this param is
     * provided.
     */
    async _verifyHitchLine(unverifiedFast, optLastSupported, optFirst) {

        // console.log("verifying hitch line from " + (optLastSupported ? optLastSupported.toString() : "<start>") +
        //       " to lead: " + unverifiedFast.toString());

        await this.verifyHitch(unverifiedFast);

        if (!optFirst && !this.isFullHitch(unverifiedFast)) {
            throw new Error("not a full hitch..."); //todo
        }
        if (optLastSupported && this.inSegment(unverifiedFast,
            this.nextTetheredTwist(unverifiedFast).hash,
            optLastSupported)) {
            return; // success - hitches have been verified back to desired point.
        }
        if (this.twist(unverifiedFast).prev()) {
            return this._verifyHitchLine(this.prevTetheredTwist(unverifiedFast).hash, optLastSupported, false);
        }
        if (optLastSupported) {
            throw new Error("This should never happen: thing in this line isn't in this line.");
        }
        // otherwise bueno
    }

    /**
     * Verifies the entire history of these twists is fastened; will
     * end with a half hitch.
     */
    async verifyHitchLine(hash, startHash = undefined) {
        let twist = this.twist(hash);

        if (!twist.isTethered()) {
            console.log("WARN!! This line ends loosely.  Are we chill with that?!");
            twist = this.prevTetheredTwist(hash);
        }
        // console.log("Top hash is:", this.topHash.toString());
        // console.log("Last lead is: ", this.prevTetheredTwist(twist.hash).hash.toString());
        return this._verifyHitchLine(this.prevTetheredTwist(twist.hash).hash, startHash, true);
    }

    // Retrieves the hitch linking this twist hash to the topline
    getToplineHitch(hash) {
        let twist = this.twist(hash);
        let lastFast = twist.lastFast();
        if (twist.lastFast()) {
            let hitch = this.hitchHoist(lastFast.getHash());
            if (hitch) {
                if (this.topHash.equals(hitch.first().getHash())) {
                    return hitch;
                } else {
                    return this.getToplineHitch(hitch.getHash());
                }
            }
        }
    }
}

export { Interpreter };
export { MissingHoistError };
export { MissingPrevious };
export { MissingSuccessor };
export { MissingPostEntry };
export { LooseTwistError };
