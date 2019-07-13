import Runtime from "./runtime";
import Collection from "./collection";
import { protectedNames, jobTypes, uuid, log } from "./helpers";

export default class Pulse {
  constructor({ collections, config = {} }) {
    if (window) window._pulse = this;
    this.uuid = uuid;
    this._private = {
      runtime: null,
      history: {},
      errors: {},
      global: {
        config,
        initComplete: false,
        runningAction: false,
        runningWatcher: false,
        runningFilter: false,
        componentStore: {},
        dispatch: this.dispatch.bind(this),
        getContext: this.getContext.bind(this),
        contextRef: {}
      }
    };
    this.mapData = this._mapData.bind(this);
    this.initCollections(collections);
    this.initRuntime();
    this.bindCollectionPublicData();
    this.runAllFilters();
    this._private.global.initComplete = true;
    console.log("INIT COMPLETE");
  }

  runAllFilters() {
    console.log("Running all filters...");
    const collectionKeys = Object.keys(this._private.collections);
    for (let i = 0; i < collectionKeys.length; i++) {
      const collection = this._private.collections[collectionKeys[i]];

      const filterKeys = collection.filters._keys;
      for (let i = 0; i < filterKeys.length; i++) {
        const filterName = filterKeys[i];
        if (filterName !== "_keys")
          this._private.runtime.performFilterOutput(
            collection.name,
            filterName
          );
      }
    }
  }

  initCollections(collections) {
    this._private.collections = {};
    let collectionKeys = Object.keys(collections);
    for (let i = 0; i < collectionKeys.length; i++) {
      const collection = collections[collectionKeys[i]];
      this._private.collections[collectionKeys[i]] = new Collection(
        { _global: this._private.global, name: collectionKeys[i] },
        collection
      );
    }
  }

  initRuntime() {
    this._private.runtime = new Runtime(
      this._private.collections,
      this._private.global
    );
  }

  bindCollectionPublicData() {
    let collectionKeys = Object.keys(this._private.collections);
    for (let i = 0; i < collectionKeys.length; i++) {
      const collection = this._private.collections[collectionKeys[i]];
      this._private.global.contextRef[collectionKeys[i]] =
        collection.public.object;
      this[collectionKeys[i]] = collection.public.object;
    }
  }

  dispatch(type, payload) {
    switch (type) {
      case "mutation":
        this._private.runtime.ingest({
          type: jobTypes.PUBLIC_DATA_MUTATION,
          collection: payload.collection,
          property: payload.key,
          value: payload.value,
          dep: payload.dep
        });
        break;

      default:
        break;
    }
  }

  // data, groups and filters are tracked as dependeies of filters,
  // so we have to access one single consistent source, not a copy.
  // Dependencies are stored in the Dep class of the **original** object.
  // We can't use "collection.data.thing" in one place and "collection.thing" in another.
  // This creates a problem with the context object since you can also read data, groups etc directly.
  // For those we're just mapping the entire public object so you can access { data } instead of { collectionName } from the context object.
  getContext(collection) {
    let normal =
      this._private.global.config.bindPropertiesToCollectionRoot !== false;
    const c = this._private.collections[collection];
    return {
      ...this._private.global.contextRef,
      ...c.methods,
      data: normal ? c.public.object : c.public.object.data,
      indexes: c.indexes.object,
      groups: normal ? c.public.object : c.public.object.groups,
      filters: normal ? c.public.object : c.public.object.filters,
      routes: c.routes
    };
  }

  install(Vue) {
    const pulse = this;
    const config = pulse._private.global.config.waitForMount;
    Vue.mixin({
      beforeCreate() {
        Object.keys(pulse.global.dataRef).forEach(collection => {
          this["$" + collection] = pulse.global.dataRef[collection];
        });

        this.$utils = pulse.utils;
        this.$services = pulse.services;
        this.$staticData = pulse.staticData;

        this.mapData = properties =>
          pulse
            .mapData(properties, this, {
              waitForMount: config.waitForMount
            })
            .bind(pulse);
      },
      mounted() {
        if (this.__pulseUniqueIdentifier && config.waitForMount)
          pulse.mount(this);
      },
      beforeDestroy() {
        if (this.__pulseUniqueIdentifier && config.autoUnmount)
          pulse.unmount(this);
      }
    });
  }
  _mapData(properties, instance, _config = {}) {
    const config = {
      waitForMount: true,
      ..._config
    };

    const componentUUID = this.registerComponent(instance, config);

    if (typeof properties === "function") {
    } else if (typeof properties === "object") {
      this.normalizeMap(properties).forEach(({ key, val }) => {
        let returnData = {};
        // parse address
        let collection = val.split("/")[0];
        let property = val.split("/")[1];
        returnData[key] = this.subscribeToCollection(
          componentUUID,
          key,
          collection,
          property
        );

        return returnData;
      });
    }
  }
  registerComponent(instance, config) {
    let uuid = instance.__pulseUniqueIdentifier;
    if (!uuid) {
      // generate UUID
      uuid = this.uuid();
      // inject uuid into component instance
      const componentContainer = {
        instance: instance,
        uuid,
        ready: config.waitForMount ? false : true
      };
      instance.__pulseUniqueIdentifier = uuid;

      this._private.global.componentStore[uuid] = componentContainer;
    } else {
      this.mount(instance);
    }
    return uuid;
  }
  subscribeComponentItentifierToCollection(uuid, key, collection, property) {
    // if collection not found return
    if (!this.hasOwnProperty(collection)) return;

    let subscribed = this._collections[collection]._subscribedToData;

    let ref = {
      componentUUID: uuid,
      key
    };

    // register component locally on collection
    if (!subscribed.hasOwnProperty(property)) {
      subscribed[property] = [ref];
    } else subscribed[property].push(ref);

    // return data values to component
    return this[collection][property];
  }
  normalizeMap(map) {
    return Array.isArray(map)
      ? map.map(key => ({ key, val: key }))
      : Object.keys(map).map(key => ({ key, val: map[key] }));
  }
}
