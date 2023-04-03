/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import { Abject } from './abject.js';

import { Primitive } from './primitive.js';

class Media extends Abject {

    static interpreter = this.gensym("/interpreters/m1");
    static fieldSyms = {
        typeName: this.gensym("field/type-name"),
        subTypeName: this.gensym("field/subtype-name"),
        value: Primitive.fieldSyms.value
    };

}

export { Media };
