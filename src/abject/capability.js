/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import { Hash } from '../core/hash.js';

import { Abject, AbjectError } from './abject.js';
import { DelegableActionable } from './actionable.js';
import { DI, DIAssetClassClass, AssetClassField } from './di.js';
import { P1String } from './primitive.js';

class CapabilityError extends AbjectError {
    constructor(cap, msg) {
        super(cap.atoms);
        this.msg = msg;
        this.cap = cap;
    }
}

class Capability extends DelegableActionable {
    static interpreter = Hash.fromHex("22eeb6569f77ff73f9ebc1583bddc8308cef7d23ebf41ac29f12d4ad7507f028af");

    static fieldSyms = {
        authorize: Hash.fromHex("222564ba77745b564eada13dc236aef5967969d8e459160c1a02e8846b530798b3"),
    };

    constructor() {
        super();
    }

    restrictions() {
        return DI.consolidate(this.delegationChain().map(x => x.getRestriction()));
    }

    url() {
        let r = this.restrictions();
        return r.getFieldAbject(Capability.simpleRestrictionAC.fieldSyms.fUrl);
    }

    methods() {
        let r = this.restrictions();
        return r.getFieldAbject(Capability.simpleRestrictionAC.fieldSyms.fHttpVerbs);
    }

    expiry() {
        let r = this.restrictions();
        return r.getFieldAbject(Capability.simpleRestrictionAC.fieldSyms.fExpiry);
    }

    getRestriction() {
        // FIXME(acg): MUST check asset class
        return this.first().getContext();
    }

    getAuthorizes() {
        // FIXME(acg): MUST check asset class
        return this.getFieldAbject(Capability.fieldSyms.authorize);
    }

    // XXX(acg): *overwrites* restriction/context, and leaves a dangling atom. only call once per twist.
    restrict(url, verbs, expiry) {
        let restriction = new DI();
        restriction.setAssetClass(Capability.simpleRestrictionAC);
        if (url) {
            restriction.setFieldAbject(Capability.simpleRestrictionAC.fieldSyms.fUrl, new P1String(url));
        }
        if (verbs && verbs.length > 0) {
            restriction.setFieldAbjects(Capability.simpleRestrictionAC.fieldSyms.fHttpVerbs,
                verbs.map(v => new P1String(v)));
        }
        if (expiry) {
            restriction.setFieldAbject(Capability.simpleRestrictionAC.fieldSyms.fExpiry, new P1String(expiry.toISOString()));
        }
        this.setContext(restriction);
    }

    authorize(url, verb, nonce) {
        let auth = new DI();
        auth.setAssetClass(Capability.simpleRequestAC);
        auth.setFieldAbject(Capability.simpleRequestAC.fieldSyms.fUrl, new P1String(url));
        auth.setFieldAbject(Capability.simpleRequestAC.fieldSyms.fHttpVerb, new P1String(verb));
        if (nonce) {
            auth.setFieldAbject(Capability.simpleRequestAC.fieldSyms.fNonce, new P1String(nonce));
        }
        this.setFieldAbject(Capability.fieldSyms.authorize, auth);
    }

    /**
     * @return <DI> representing authorized request iff restriction logic
     * permits this authorization to occur.
     */
    async getCheckedAuthorization() {
        // XXX(acg): In theory, this logic could potentially be elsewhere, but
        // it seems to fit fairly nicely in here.

        // XXX(acg): Checking the nonce, and whether the current actual request
        // matches the auth remains up to the app. Also needs to check expiry
        // itself...

        await this.checkAllRigs();

        let restrictions = this.restrictions();
        let auth = this.getAuthorizes();
        if (!auth) {
            throw new CapabilityError(this, "Does not point to an authorization");
        }
        if (!restrictions) {
            throw new CapabilityError(this, "Capability has no context");
        }
        let url = auth.getFieldAbject(Capability.simpleRequestAC.fieldSyms.fUrl);
        if (!url) {
            throw new CapabilityError(this, "Auth does not specify a URL");
        }
        let rUrl = restrictions.getFieldAbject(Capability.simpleRequestAC.fieldSyms.fUrl);
        if (!rUrl) {
            throw new CapabilityError(this, "Capability does not specify permitted resource");
        }
        if (url != rUrl) {
            throw new CapabilityError(this, "Capability cannot grant authorized HTTP resource");
        }

        let verb = auth.getFieldAbject(Capability.simpleRequestAC.fieldSyms.fHttpVerb);
        if (!verb) {
            throw new CapabilityError(this, "auth does not specify allowed HTTP methods");
        }
        let allowedMethods = restrictions.getFieldAbject(Capability.simpleRestrictionAC.fieldSyms.fHttpVerbs);
        if (allowedMethods && !allowedMethods.includes(verb)) {
            throw new CapabilityError(this, "Capability insufficient to grant authorized HTTP method");
        }

        return auth;
    }
}

Abject.registerInterpreter(Capability);


let fUrl = new AssetClassField();
fUrl.consolidation = DI.consolidations.firstWriteWins;
fUrl.type = P1String.interpreter;
fUrl.required = true;

let fHttpVerbs = new AssetClassField();
fHttpVerbs.consolidation = DI.consolidations.remove;
fHttpVerbs.type = P1String.interpreter;
fHttpVerbs.list = true;

let fExpiry = new AssetClassField();
fExpiry.consolidation = DI.consolidations.append;
fExpiry.type = P1String.interpreter;

Capability.simpleRestrictionAC = new DIAssetClassClass();
Capability.simpleRestrictionAC.fieldSyms = {};
Capability.simpleRestrictionAC.fieldSyms.fUrl = Capability.gensym("field/url");
Capability.simpleRestrictionAC.fieldSyms.fHttpVerbs = Capability.gensym("field/http-verbs");
Capability.simpleRestrictionAC.fieldSyms.fExpiry = Capability.gensym("field/expiry");

Capability.simpleRestrictionAC.addACField(Capability.simpleRestrictionAC.fieldSyms.fUrl,
    fUrl);
Capability.simpleRestrictionAC.addACField(Capability.simpleRestrictionAC.fieldSyms.fHttpVerbs,
    fHttpVerbs);
Capability.simpleRestrictionAC.addACField(Capability.simpleRestrictionAC.fieldSyms.fExpiry,
    fExpiry);

let fHttpVerb = new AssetClassField();
fHttpVerb.consolidation = DI.consolidations.firstWriteWins;
fHttpVerb.type = P1String.interpreter;

let fNonce = new AssetClassField();
fNonce.consolidation = DI.consolidations.firstWriteWins;
fNonce.type = P1String.interpreter;

Capability.simpleRequestAC = new DIAssetClassClass();
Capability.simpleRequestAC.fieldSyms = {};
Capability.simpleRequestAC.fieldSyms.fUrl = Capability.gensym("field/url");
Capability.simpleRequestAC.fieldSyms.fHttpVerb = Capability.gensym("field/http-verb");
Capability.simpleRequestAC.fieldSyms.fNonce = Capability.gensym("field/nonce");

Capability.simpleRequestAC.addACField(Capability.simpleRequestAC.fieldSyms.fUrl,
    fUrl);
Capability.simpleRequestAC.addACField(Capability.simpleRequestAC.fieldSyms.fHttpVerb,
    fHttpVerb);
Capability.simpleRequestAC.addACField(Capability.simpleRequestAC.fieldSyms.fNonce,
    fNonce);

export { Capability };