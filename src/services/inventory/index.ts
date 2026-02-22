import * as productsMethods from "./products";
import * as storesMethods from "./stores";
import * as reportsMethods from "./reports";
import * as syncMethods from "./sync";
import * as coreMethods from "./core";

export * from "./types";

export const InventoryService = {
  ...productsMethods,
  ...storesMethods,
  ...reportsMethods,
  ...syncMethods,
  ...coreMethods
};

export default InventoryService;
