/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import { Hash } from '../core/hash.js';

import { Abject } from './abject.js';
import { DelegableActionable } from './actionable.js';
import { P1Float } from './primitive.js';
import { DI, DIAssetClassClass, AssetClassField } from './di.js';

class DQ extends DelegableActionable {
    static interpreter = Hash.fromHex("220a6a20be9131b708b193e1373aa4df209719e1d3f451836fa62245e4aed234a7");

    // dx: this throws because everything else throws, but maybe 
    //  it shouldn't? it could easily be a one-liner.
    static displayToQuantity(value, displayPrecision) {
        if (DQ.safeDisplayPrecision(displayPrecision) === false) {
            throw new Error("displayPrecision must be an integer " + 
                "between 0 and 15, inclusive");
        }

        let quantity = value * 10**displayPrecision;
        quantity = +quantity.toFixed(0);

        if (DQ.safeQuantity(quantity) < 0) {
            throw new Error("Quantity must be a non-negative integer");
        }

        return quantity;
    }

    static quantityToDisplay(quantity, displayPrecision) {
        if (DQ.safeDisplayPrecision(displayPrecision) === false) {
            throw new Error("displayPrecision must be an integer " +
                "between 0 and 15, inclusive");
        }

        if (DQ.safeQuantity(quantity) < 0) {
            throw new Error("Quantity must be a non-negative whole number");
        }

        let value = quantity / 10**displayPrecision;
        return +value.toFixed(displayPrecision);
    }

    static safeQuantity(quantity) {
        if (quantity < 0) {
            return 0;
        }
        if (quantity > Number.MAX_SAFE_INTEGER) {
            return 0;
        }
        if (!Number.isInteger(quantity)) {
            return 0;
        }
        return quantity;
    }

    static safeDisplayPrecision(displayPrecision) {
        if (!Number.isInteger(displayPrecision)) {
            return false;
        }
        if (displayPrecision < 0) {
            return false;
        }
        if (displayPrecision > 15) {
            return false;
        }
        return displayPrecision;
    }

    static mint(quantity, displayPrecision=0, mintingInfo) {
        if (DQ.safeQuantity(quantity) <= 0) {
            throw new Error("Quantity minted must be a positive integer");
        }
        if (DQ.safeDisplayPrecision(displayPrecision) === false) {
            throw new Error("displayPrecision must be an " + 
                "integer between 0 and 15, inclusive");
        }

        let c = new DI();
        c.setAssetClass(DQ.context);
        c.setFieldAbject(DQ.context.fieldSyms.quantity, new P1Float(quantity));
        c.setFieldAbject(DQ.context.fieldSyms.displayPrecision, 
            new P1Float(displayPrecision ? displayPrecision : 0));
        if (mintingInfo) {
            // todo: check type.
            c.setFieldAbject(DQ.context.fieldSyms.mintingInfo, mintingInfo);
        }

        let x = new DQ();
        x.setContext(c);
        return x;
    }

    // Returns a new first twist of a DQ which 
    //  _must_ be confirmed, then completed.
    delegate(quantity) {
        if (DQ.safeQuantity(quantity) <= 0) {
            throw new Error("Quantity delegated must be a positive integer");
        }

        if (quantity > this.quantity) {
            // NOTE: on write we block this, but on read we allow 
            //  this and make it equal to parent's quantity
            throw new Error("The delegate's quantity must "
                + "not be greater than the delegator's quantity");
        }

        let x = this.createDelegate();
        let c = new DI();
        c.setAssetClass(DQ.context);
        c.setFieldAbject(DQ.context.fieldSyms.quantity, new P1Float(quantity));
        x.setContext(c);
        return x;
    }

    get quantity() {
        // a DQ twist can do at most a single thing: just one of the three 
        //  delegation actions, and in the singular. the initiate -> complete 
        // -> confirm order is important (it's from the spec)

        function safeClaimedQuantity(dq) {
            return DQ.safeQuantity(dq?.getContext()?.
                getFieldAbject(DQ.context.fieldSyms.quantity));
        }

        // - cached quantity? return it.
        if (this.cachedQuantity !== undefined) {
            return this.cachedQuantity;
        }

        // - initiate? we have zero value
        let initiation = this.getFieldAbject(DelegableActionable.
            fieldSyms.delegateInitiate);
        if (initiation) {
            if (this.prev()) {
                // initiation after the first twist does nothing
                return this.cachedQuantity = this.prev().quantity; 
            }
            return this.cachedQuantity = 0;
        }

        // - complete a delegation? return our claim, 
        // or delegator.prev().quantity, whichever is smaller
        let completion = this.getField(
            DelegableActionable.fieldSyms.delegateComplete);
        if (completion) {
            if (!this.prev() || this.prev()?.prev()) {
                 // completion outside the second twist does nothing
                return this.cachedQuantity = this.prev().quantity;
            }
            let delegator = this.delegateOf();
            // delegator might not exist
            let total = DQ.safeQuantity(delegator?.prev()?.quantity); 
            // NOTE: enforces prev as initiate, consider adding flex
            let claim = safeClaimedQuantity(this.prev());
            if (delegator?.confirmedDelegates()?.length > 1) {
                total = 0; // can't confirm more than one delegate at a time
            }
            return this.cachedQuantity = Math.min(total, claim);
        }

        // - confirm a single delegate? return prev.quantity 
        //  minus safe claimed delegate amount
        let confirmation = this.getField(
            DelegableActionable.fieldSyms.delegateConfirm);
        if (confirmation) {
            let dq = 0; // delegate quantity
            let hashes = confirmation.shapedVal;
            if (hashes.length === 1) {
                let delegate = this.getAbject(hashes[0]); // the initiate
                dq = safeClaimedQuantity(delegate);
            }
            let pq = this.prev().quantity; // recursive prev quantity
            // don't get negative
            return this.cachedQuantity = Math.max(pq - dq, 0); 
        }

        // - initial root twist? return our safe claimed quantity
        let isRoot = this === this.first();
        if (isRoot) {
            let quantity = safeClaimedQuantity(this);
            return this.cachedQuantity = quantity;
        }

        // - otherwise, just return prev.quantity
        return this.cachedQuantity = this.prev().quantity;
    }

    get displayPrecision() {
        if (this.cachedDisplayPrecision === undefined) {
            let c = this.rootContext();
            this.cachedDisplayPrecision = DQ.safeDisplayPrecision(
                c?.getFieldAbject(DQ.context.fieldSyms.displayPrecision)) || 0;
        }
        return this.cachedDisplayPrecision;
    }

    get mintingInfo() {
        if (this.cachedMintingInfo === undefined) {
            let c = this.rootContext();
            this.cachedMintingInfo = !c ? null : 
                c.getFieldAbject(DQ.context.fieldSyms.mintingInfo);
        }
        return this.cachedMintingInfo;
    }

}

DQ.context = new DIAssetClassClass();

DQ.context.fieldSyms = {
    quantity: Hash.fromHex("229cd0e35e7f233a1c03f620f7c5024baf35c229df81ad613c622996bc1dc4da37"),
    displayPrecision: Hash.fromHex("2248a88ced3cb2ee7e8187fccc4d70dad8ec75bb8f01b5dbfcdf94ef0ce4fcaea4"),
    mintingInfo: Hash.fromHex("220b0bfdd07d701255a52dff626c4a69b7af73e42061857b4b04537542c4e4ea52")
};

let fQuantity = new AssetClassField();
// perhaps introduce a "must not be consolidated" thing.
fQuantity.type = P1Float.interpreter;
fQuantity.required = true;

let fDisplayPrecision = new AssetClassField();
fDisplayPrecision.type = P1Float.interpreter;

let fMintingInfo = new AssetClassField();
fMintingInfo.type = DI.interpreter;

DQ.context.addACField(DQ.context.fieldSyms.quantity, fQuantity);
DQ.context.addACField(DQ.context.fieldSyms.displayPrecision, fDisplayPrecision);
DQ.context.addACField(DQ.context.fieldSyms.mintingInfo, fMintingInfo);

Abject.registerInterpreter(DQ);
export { DQ };