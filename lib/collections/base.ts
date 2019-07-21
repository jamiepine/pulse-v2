import Collection from "../collection";
import { Global, CollectionObject } from "../interfaces";

export default class Request extends Collection {
  constructor(name: string, global: Global, root: CollectionObject = {}) {
    if (root.data) root.data = {};
    if (root.persist) root.persist = [];

    root.data["isAuthenticated"] = false;
    root.data["appReady"] = false;
    root.persist.push("isAuthenticated");

    super(name, global, root);
  }
}
