import Reactive from "./reactive";
import { protectedNames } from "./helpers";

export default class Collection {
  constructor(
    { name, dispatch, global },
    {
      config = {},
      data = {},
      model = {},
      actions = {},
      filters = {},
      groups = [],
      routes = {},
      watch = {},
      persist = [],
      local = {},
      onReady
    }
  ) {
    this.name = name;
    this.config = config;
    this.global = global;
    this.dispatch = dispatch;
    groups = this.normalizeGroups(groups);

    this.internalData = {};

    this.prepareNamespace({ data, groups, filters, actions });
    this.initReactive(data, groups);
  }

  prepareNamespace(types) {
    this.public = {};
    if (this.global.config.bindPropertiesToCollectionRoot === false) {
      return;
    }
    // let dataKeys = Object.keys(types.data);
    // for (let i = 0; i < dataKeys.length; i++) {
    //   const dataName = dataKeys[i];
    // }
  }

  normalizeGroups(groupsAsArray) {
    const groups = {};
    for (let i = 0; i < groupsAsArray.length; i++) {
      const groupName = groupsAsArray[i];
      groups[groupName] = [];
    }
    return groups;
  }

  initReactive(data, groups) {
    let dataKeys = Object.keys(data);
    let groupKeys = Object.keys(groups);
    // Make data reactive
    this.data = new Reactive(data, this.dispatch, {
      mutable: dataKeys,
      type: "data",
      collection: this.name
    });
    this.public.data = this.data.object;

    if (this.global.config.bindPropertiesToCollectionRoot !== false) {
      for (let i = 0; i < dataKeys.length; i++) {
        const key = dataKeys[i];
        this.public[key] = this.data.object[key];
      }
    }
    // Make indexes reactive
    this.indexes = new Reactive(groups, this.dispatch, {
      mutable: groupKeys,
      type: "indexes",
      collection: this.name
    });
    this.public.indexes = this.indexes.object;

    // Make entire public object Reactive
    this.public = new Reactive(this.public, this.dispatch, {
      mutable: [...dataKeys, ...groupKeys],
      collection: this.name
    });
  }
}
