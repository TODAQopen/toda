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

    getQuantity() {

        let startQuantity =  this.first().getContext().getFieldAbject(DQ.context.fieldSyms.quantity);
        let parent = this.delegateOf();
        if (parent) {
            // parent quantity already includes this subtraction, and any co-issued siblings.
            let parentQuantity = parent.getQuantity();

            if (parentQuantity <= 0) {
                startQuantity = 0;  // we could actually do a minimum of
                // something, but we would need to define
                // the order that delegates would receive
                // value where an entire co-confirmed bundle
                // goes over. I suppose we could use the
                // actual order specified in that bundle,
                // but lots of sharp edges here.
            }
        }

        let delegatedQuantity = 0;
        for (let del of this.allConfirmedDelegates()) {
            if (del) {
                delegatedQuantity +=  del.getContext().getFieldAbject(DQ.context.fieldSyms.quantity);
            }
        }
        return startQuantity - delegatedQuantity;
    }

    getUnits() {
        let c = this.rootContext();
        if (c) {
            let u = c.getFieldAbject(DQ.context.fieldSyms.units);
            if (u) {
                return u;
            }
            return 1;
        }
        return 1;
    }

    getMintingInfo() {
        let c = this.rootContext();
        if (c) {
            return c.getFieldAbject(DQ.context.fieldSyms.mintingInfo);
        }
        return null;
    }

    value() {
        return this.quantityToValue(DQ.safeQuantity(this.getQuantity()));
    }

    quantityToValue(quantity) {
        return quantity / this.getUnits();
    }

    valueToQuantity(value) {
        return value * this.getUnits();
    }

    static mint(quantity, units, mintingInfo) {
        let c = new DI();
        c.setAssetClass(DQ.context);
        c.setFieldAbject(DQ.context.fieldSyms.quantity, new P1Float(quantity));
        c.setFieldAbject(DQ.context.fieldSyms.units, new P1Float(units ? units : 1));
        if (mintingInfo) {
            // todo: check type.
            c.setFieldAbject(DQ.context.fieldSyms.mintingInfo, mintingInfo);
        }
        let x = new DQ();
        x.setContext(c);
        return x;
    }

    /**
       Determines whether or not the value has the correct precision for this dq
        ie. if units = 10, then value = 0.2 is valid, but value = 0.21 is not, since
        it has more precision than the units
      */
    isValueDelegable(value) {
        return (value * this.getUnits()) % 1 == 0;
    }

    // Returns a new first twist of a DQ which _must_ be confirmed, then completed.
    delegateValue(value) {
        if (!this.isValueDelegable(value)) {
            throw new Error("Value specified is not able to be delegated.");
        }

        if (DQ.safeQuantity(value) <= 0) {
            throw new Error("Value must be a positive number");
        }

        if (this.value() < value) {
            throw new Error("Value is greater than this DQ's value");
        }

        let x = this.createDelegate();
        let c = new DI();
        c.setAssetClass(DQ.context);
        c.setFieldAbject(DQ.context.fieldSyms.quantity, new P1Float(this.valueToQuantity(value)));
        x.setContext(c);
        return x;
    }

}

DQ.context = new DIAssetClassClass();

let fQuantity = new AssetClassField();
// perhaps introduce a "must not be consolidated" thing.
fQuantity.type = P1Float.interpreter;
fQuantity.required = true;

let fUnits = new AssetClassField();
fUnits.type = P1Float.interpreter;

let fMintingInfo = new AssetClassField();
fMintingInfo.type = DI.interpreter;

DQ.context.fieldSyms = {
    quantity: Hash.fromHex("229cd0e35e7f233a1c03f620f7c5024baf35c229df81ad613c622996bc1dc4da37"),
    units: Hash.fromHex("2248a88ced3cb2ee7e8187fccc4d70dad8ec75bb8f01b5dbfcdf94ef0ce4fcaea4"),
    mintingInfo: Hash.fromHex("220b0bfdd07d701255a52dff626c4a69b7af73e42061857b4b04537542c4e4ea52")
};

DQ.context.addACField(DQ.context.fieldSyms.quantity, fQuantity);
DQ.context.addACField(DQ.context.fieldSyms.units, fUnits);
DQ.context.addACField(DQ.context.fieldSyms.mintingInfo, fMintingInfo);

Abject.registerInterpreter(DQ);
export { DQ };
