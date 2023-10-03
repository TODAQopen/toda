import { DI, DIAssetClassClass, AssetClassField } from "../../src/abject/di.js";
import { Primitive, P1String, P1Float, P1Date, P1Boolean } from "../../src/abject/primitive.js";
import { Media } from "../../src/abject/media.js";
import assert from 'node:assert/strict';

// Output key values for our use
describe("Give me hashes", () => {
    it("gives me hashes", () => {

        console.log("B1/value:", Primitive.fieldSyms.value.toString());

        console.log("B1/UTF8:", P1String.interpreter.toString());
        console.log("B1/IEEE754:", P1Float.interpreter.toString());
        console.log("B1/Date:", P1Date.interpreter.toString());
        console.log("B1/Boolean", P1Boolean.interpreter.toString());

        console.log("M1:", Media.interpreter.toString());
        console.log("M1/fields/typename:", Media.fieldSyms.typeName.toString());
        console.log("M1/fields/subtypename:", Media.fieldSyms.subTypeName.toString());

        console.log("DI:", DI.interpreter.toString());

        console.log("DI/fields/asset-class", DI.fieldSyms.assetClass.toString());

    });
});

//TODO: many, many more di tests: lists, etc. etc.
describe("Consolidate fields", () => {
    let ac = new DIAssetClassClass();
    let f1 = new AssetClassField();
    f1.consolidation = DI.consolidations.lastWriteWins;
    let f1name = DI.gensym("mytests/field/name");
    ac.addACField(f1name, f1);

    let f2 = new AssetClassField();
    f2.consolidation = DI.consolidations.append;
    let f2friends = DI.gensym("mytests/field/friends");
    ac.addACField(f2friends, f2);

    let x = new DI();
    x.setAssetClass(ac);
    x.setFieldAbject(f1name, new P1String("huerto juanita de la fuerto conseuella von schmidt"));
    let y = new DI();
    y.setAssetClass(ac);
    y.setFieldAbject(f1name, new P1String("smith"));

    it("reports asset class fields", () => {
        let fields = ac.getFieldHashes();
        assert.equal(fields.length, 2);
    });

    it("can create and use an asset class", () => {
        assert.equal(DI.consolidate([x,y]).getFieldAbject(f1name),"smith");
    });

});