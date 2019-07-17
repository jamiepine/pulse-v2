import Runtime from "./runtime";
import Collection from "./collection";
import SubController from "./subController";
import { jobTypes, uuid, normalizeMap } from "./helpers";
import { Private, Config, RootCollectionObject, JobType } from "./interfaces";

export default class Library {
  _private: Private;
  constructor(root: RootCollectionObject) {
    this._private = {
      runtime: null,
      global: {
        config: root.config,
        initComplete: false,
        runningAction: false,
        runningWatcher: false,
        runningFilter: false,
        collecting: false,
        subs: new SubController(this.getContext.bind(this)),
        dispatch: this.dispatch.bind(this),
        getContext: this.getContext.bind(this),
        contextRef: {},
        uuid
      }
    };
    // this.mapData = this._mapData.bind(this);
    this.initCollections(root.collections);
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

      const filterKeys = collection.keys.filters;
      for (let i = 0; i < filterKeys.length; i++) {
        const filterName = filterKeys[i];
        this._private.runtime.performFilterOutput(collection.name, filterName);
      }
    }
  }

  initCollections(collections: object) {
    this._private.collections = {};
    let collectionKeys = Object.keys(collections);
    for (let i = 0; i < collectionKeys.length; i++) {
      const collection = collections[collectionKeys[i]];
      this._private.collections[collectionKeys[i]] = new Collection(
        collectionKeys[i],
        this._private.global,
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
          type: JobType.PUBLIC_DATA_MUTATION,
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

  getContext(collection) {
    const c = this._private.collections[collection];
    if (!c) return this._private.global.contextRef;
    return {
      ...this._private.global.contextRef,
      ...c.methods,
      data: c.public.object,
      indexes: c.indexes.object,
      groups: c.public.object,
      filters: c.public.object,
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

  mapData(properties, instance = {}, _config = {}) {
    const config = {
      waitForMount: true,
      ..._config
    };
    const componentUUID = this._private.global.subs.registerComponent(
      instance,
      config
    );
    // new cool mapData method
    if (typeof properties === "function") {
      return this._private.global.subs.subscribePropertiesToComponents(
        properties,
        componentUUID
      );
      // legacy support....
    } else if (typeof properties === "object") {
      let returnData = {};
      normalizeMap(properties).forEach(({ key, val }) => {
        let collection = val.split("/")[0];
        let property = val.split("/")[1];
        let c = this._private.global.getContext()[collection];
        returnData = this._private.global.subs.subscribePropertiesToComponents(
          () => {
            return { [key]: c[property] };
          },
          componentUUID
        );
      });
      return returnData;
    }
  }
}
