/*************************************************************
 * TODAQ Open: TODA File Implementation
 * Toronto 2022
 *
 * Apache License 2.0
 *************************************************************/

import { DI, DIAssetClassClass, AssetClassField } from './di';

import { SimpleRigged } from './actionable';
import { P1String, P1Float } from './primitive';
import { ArbitraryPacket } from '../core/packet';

/**
 * Creates a todaized file
 *
 * @param byteArray <ByteArray> representing the data that will be included in the payload
 * @param popTopHash <Hash> the pop top that this abject will be tethered to
 * @param opts <Map> Containing the following params:
 * @param fileName <string> a string representing the name of the file
 * @param description <string> a string describing the file
 * @param timeCreated <string> a string (in ISO 8601 format) representing the time this file was created
 * @param timeModified <string> a string (in ISO 8601 format) representing the time this file was last modified
 * @returns <SimpleRigged> the todaized SimpleRigged abject
 */
function todaize(byteArray,
                 popTopHash,
                 opts = {})
{
    let packet = new ArbitraryPacket(byteArray);
    let x = new DI();
    x.setAssetClass(Todaized);
    x.setField(Todaized.fieldSyms.fFileContent, packet);
    x.setFieldAbject(Todaized.fieldSyms.fFileSize, new P1Float(byteArray.length));
    if (opts.fileName)
        x.setFieldAbject(Todaized.fieldSyms.fFileName, new P1String(opts.fileName));
    if (opts.timeCreated)
        x.setFieldAbject(Todaized.fieldSyms.fFileCreated, new P1String(opts.timeCreated));
    if (opts.timeModified)
        x.setFieldAbject(Todaized.fieldSyms.fFileModified, new P1String(opts.timeModified));
    if (opts.description)
        x.setFieldAbject(Todaized.fieldSyms.fFileDescr, new P1String(opts.description));
    let sr = new SimpleRigged();
    sr.setContext(x);
    sr.setPopTop(popTopHash);
    return sr;
}

let fFileName = new AssetClassField();
fFileName.consolidation = DI.consolidations.lastWriteWins;
fFileName.type = P1String.interpreter;
fFileName.required = false;

let fFileSize = new AssetClassField();
fFileSize.consolidation = DI.consolidations.firstWriteWins;
fFileSize.type = P1Float.interpreter;
fFileSize.required = false;

let fFileDescr = new AssetClassField();
fFileDescr.consolidation = DI.consolidations.lastWriteWins;
fFileDescr.type = P1String.interpreter;
fFileDescr.required = false;

let fFileContent = new AssetClassField();
fFileDescr.consolidation = DI.consolidations.firstWriteWins;
fFileDescr.required = true;

let fFileCreated = new AssetClassField();
fFileCreated.consolidation = DI.consolidations.firstWriteWins;
fFileCreated.type = P1String.interpreter;
fFileCreated.required = false;

let fFileModified = new AssetClassField();
fFileModified.consolidation = DI.consolidations.firstWriteWins;
fFileModified.type = P1String.interpreter;
fFileModified.required = false;

var Todaized = new DIAssetClassClass();
Todaized.fieldSyms = {fFileName: DI.gensym('todaized/field/fFileName'),
                      fFileSize: DI.gensym('todaized/field/fFileSize'),
                      fFileDescr: DI.gensym('todaized/field/fFileDescr'),
                      fFileContent: DI.gensym('todaized/field/fFileContent'),
                      fFileCreated: DI.gensym('todaized/field/fFileCreated'),
                      fFileModified: DI.gensym('todaized/field/fFileModified')};

Todaized.addACField(Todaized.fieldSyms.fFileName, fFileName);
Todaized.addACField(Todaized.fieldSyms.fFileSize, fFileSize);
Todaized.addACField(Todaized.fieldSyms.fFileDescr, fFileDescr);
Todaized.addACField(Todaized.fieldSyms.fFileContent, fFileContent);
Todaized.addACField(Todaized.fieldSyms.fFileCreated, fFileCreated);
Todaized.addACField(Todaized.fieldSyms.fFileModified, fFileModified);

export { Todaized };
export { todaize };
