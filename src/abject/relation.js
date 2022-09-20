/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
* 
* Apache License 2.0
*************************************************************/

const {Abject} = require("./abject");
const {Symbol} = require("./symbol");
const {Primitive} = require("./primitive");

class Relation extends Abject {
    static interpreter = Symbol.gen("/interpreters/r1");
    static fieldSyms = {
        entity: this.gensym("entity"),
        attr: this.gensym("attribute"),
        val: Primitive.fieldSyms.value
    };

    /**
     * Your basic EAV gizmo
     * @param entity <Hash>
     * @param attr <Hash>
     * @param val <Hash>
     */
    constructor(entity, attr, val) {
        super();
        this.setFieldHash(this.fieldSyms.entity, entity);
        this.setFieldHash(this.fieldSyms.attr, attr);
        this.setFieldHash(this.fieldSyms.val, val);
    }

    // TODO: add getters, helpers
}

Abject.registerInterpreter(Relation);
