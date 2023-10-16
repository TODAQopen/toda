import * as fs from 'fs';
const packageJSON = JSON.parse(fs.readFileSync('./package.json'));

/** Core **/
export { Hash,
         Sha256 as Sha256Hash,
         Symbol as SymbolHash,
         NullHash } from "./src/core/hash.js";
export { Interpreter } from  "./src/core/interpret.js";
export { Twist, TwistBuilder } from  "./src/core/twist.js";
/** SignatureRequirement used by server/test/test_import_integration */
export { SignatureRequirement } from  "./src/core/reqsat.js";

/** Abjects **/
export { Abject } from  "./src/abject/abject.js";
export { SimpleRigged, DelegableActionable } from  "./src/abject/actionable.js";
export { Capability } from  "./src/abject/capability.js";
export { P1String, P1Date } from  "./src/abject/primitive.js";
export { DI, DIAssetClassClass, AssetClassField } from  "./src/abject/di.js";
export { DQ } from  "./src/abject/quantity.js";

/** Client **/
export { LocalInventoryClient } from  "./src/client/inventory.js";
export { LocalRelayClient, RemoteRelayClient }
    from "./src/client/relay.js";
export { TodaClient } from  "./src/client/client.js";

/** Signature Implementations */
export { SECP256r1 } from  "./src/client/secp256r1.js";

/** Testing */
export { TestRelayServer } from "./test/client/relay_server.js";



export const version = packageJSON.version;
