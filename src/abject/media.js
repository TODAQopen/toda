/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
* 
* Apache License 2.0
*************************************************************/

const {Abject} = require("./abject");
const {Primitive} = require("./primitive");

class Media extends Abject {

    static interpreter = this.gensym("/interpreters/m1");
    static fieldSyms = {
	      typeName: this.gensym("field/type-name"),
	      subTypeName: this.gensym("field/subtype-name"),
	      value: Primitive.fieldSyms.value
    };

}

exports.Media = Media;
