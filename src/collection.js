import Reactive from "./reactive";
import { protectedNames } from "./helpers";
import Action from "./action";
import Filter from "./filter";

export default class Collection {
  constructor(
    { name, _global },
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
    this.global = _global;
    this.dispatch = _global.dispatch;
    groups = this.normalizeGroups(groups);

    this.methods = {
      collect: this.collect.bind(this)
    };

    this.internalData = {};

    this.prepareNamespace({ data, groups, filters, actions });
    this.initReactive(data, groups);

    this.initActions(actions);
    this.initWatchers(watch);
    this.initFilters(filters);
  }

  prepareNamespace(types) {
    const _filters = {};
    Object.keys(types.filters).forEach(key => (_filters[key] = null));
    const _groups = {};
    Object.keys(types.groups).forEach(key => (_groups[key] = null));

    this.public = {
      routes: {}
    };
    if (this.global.config.bindPropertiesToCollectionRoot !== false) {
      this.public = {
        ...this.public,
        ..._filters,
        ..._groups
      };
    } else {
      this.public = {
        ...this.public,
        filters: _filters,
        groups: _groups,
        data: {},
        actions: {}
      };
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
    this.data = new Reactive(data, this.global, {
      mutable: dataKeys,
      type: "data",
      collection: this.name
    });

    if (this.global.config.bindPropertiesToCollectionRoot !== false) {
      for (let i = 0; i < dataKeys.length; i++) {
        const key = dataKeys[i];
        this.public[key] = this.data.object[key];
      }
    } else {
      this.public.data = this.data.object;
    }
    // Make indexes reactive
    this.indexes = new Reactive(groups, this.global, {
      mutable: groupKeys,
      type: "indexes",
      collection: this.name
    });
    this.public.indexes = this.indexes.object;

    // Make entire public object Reactive
    this.public = new Reactive(this.public, this.global, {
      mutable: [...dataKeys, ...groupKeys],
      collection: this.name
    });
  }

  initActions(actions) {
    this.actions = {};
    let actionKeys = Object.keys(actions);
    for (let i = 0; i < actionKeys.length; i++) {
      const action = actions[actionKeys[i]];
      this.actions[actionKeys[i]] = new Action(
        {
          collection: this.name,
          global: this.global
        },
        action,
        actionKeys[i]
      );

      if (this.global.config.bindPropertiesToCollectionRoot !== false) {
        this.public.privateWrite(
          actionKeys[i],
          this.actions[actionKeys[i]].exec
        );
      } else {
        this.public.object.actions[actionKeys[i]] = this.actions[
          actionKeys[i]
        ].exec;
      }
    }
    this.actions._keys = actionKeys;
  }

  initWatchers(watchers) {
    const _this = this;
    this.watchers = {};
    let watcherKeys = Object.keys(watchers);
    for (let i = 0; i < watcherKeys.length; i++) {
      const watcher = watchers[watcherKeys[i]];
      this.watchers[watcherKeys[i]] = function() {
        _this.global.runningWatcher = {
          collection: _this.name,
          property: watcherKeys[i]
        };
        const watcherOutput = watcher.apply(
          null,
          [_this.global.getContext(_this.name)].concat(
            Array.prototype.slice.call(arguments)
          )
        );
        _this.global.runningWatcher = false;
        return watcherOutput;
      };
    }
    this.watchers._keys = watcherKeys;
  }

  initFilters(filters) {
    this.filters = {};
    const filterKeys = Object.keys(filters);
    for (let i = 0; i < filterKeys.length; i++) {
      const filterName = filterKeys[i];
      const filterFunction = filters[filterKeys[i]];
      // set the property to an empty array, until we've parsed the filter
      this.filters[filterName] = new Filter(
        this.global,
        this.name,
        filterName,
        filterFunction
      );

      if (this.global.config.bindPropertiesToCollectionRoot !== false) {
        this.public.object[filterName] = [];
      } else {
        this.public.object.filters[filterName] = [];
      }
    }
    this.filters._keys = filterKeys;
  }

  // METHODS
  collect() {}
}
