import Runtime from "./runtime";
import Collection from "./collection";

export default class Pulse {
  constructor({ collections, config = {} }) {
    this._private = {
      runtime: null,
      global: {
        config
      }
    };
    this.initCollections(collections);
    this.bindCollectionPublicData();

  }

  initCollections(collections) {
    this._private.collections = {};
    const refs = {
      global: this._private.global,
      dispatch: this.dispatch.bind(this)
    };
    let collectionKeys = Object.keys(collections);
    for (let i = 0; i < collectionKeys.length; i++) {
      const collection = collections[collectionKeys[i]];
      this._private.collections[collectionKeys[i]] = new Collection(
        { ...refs, name: collectionKeys[i] },
        collection
      );
    }
    this._private.runtime = new Runtime(this._private.collections, this._private.global)
  }

  bindCollectionPublicData() {
    let collectionKeys = Object.keys(this._private.collections);
    for (let i = 0; i < collectionKeys.length; i++) {
      const collection = this._private.collections[collectionKeys[i]];
      this[collectionKeys[i]] = collection.public.object;
    }
  }

  dispatch(type, payload) {
    switch (type) {
      case "mutation":
        this._private.runtime.commitPublicDataUpdate(payload.collection, payload.key, payload.value )
        break;

      default:
        break;
    }
  }
}
