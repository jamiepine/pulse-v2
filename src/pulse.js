import Runtime from "./runtime";
import Collection from "./collection";
import { protectedNames, jobTypes } from "./helpers";

export default class Pulse {
  constructor({ collections, config = {} }) {
    this._private = {
      runtime: null,
      _global: {
        config,
        currentAction: null,
        registerCurrentAction: this.registerCurrentAction.bind(this),
        unregisterCurrentAction: this.unregisterCurrentAction.bind(this),
        getContext: this.getContext.bind(this),
        contextRef: {}
      }
    };
    this.initCollections(collections);
    this.bindCollectionPublicData();
  }

  initCollections(collections) {
    this._private.collections = {};
    const refs = {
      _global: this._private._global,
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
    this._private.runtime = new Runtime(
      this._private.collections,
      this._private._global
    );
  }

  bindCollectionPublicData() {
    let collectionKeys = Object.keys(this._private.collections);
    for (let i = 0; i < collectionKeys.length; i++) {
      const collection = this._private.collections[collectionKeys[i]];
      this._private._global.contextRef[collectionKeys[i]] =
        collection.public.object;
      this[collectionKeys[i]] = collection.public.object;
    }
  }

  dispatch(type, payload) {
    switch (type) {
      case "mutation":
        this._private.runtime.ingest(
          jobTypes.PUBLIC_DATA_MUTATION,
          payload.collection,
          payload.key,
          payload.value
        );
        break;

      default:
        break;
    }
  }

  getContext(collection) {
    return {
      ...this._private._global.contextRef,
      data: this._private.collections[collection].data.object,
      indexes: this._private.collections[collection].indexes.object,
      groups: this._private.collections[collection].groups,
      filters: this._private.collections[collection].filters,
      routes: this._private.collections[collection].routes
    };
  }

  registerCurrentAction(action) {
    this._private._global.currentAction = action;
  }
  unregisterCurrentAction() {
    this._private._global.currentAction = null;
  }
}
