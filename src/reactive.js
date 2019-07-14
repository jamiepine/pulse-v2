import { protectedNames, arrayFunctions, isWatchableObject } from "./helpers";
import Dep from "./dep";

export default class Reactive {
  constructor(object = {}, _global, config = {}) {
    this.global = _global;
    this.config = config;
    this.mutable = config.mutable || [];
    this.collection = config.collection;
    this.type = config.type || "root";
    this.dispatch = this.global.dispatch;
    this.allowPrivateWrite = false;
    this.properties = Object.keys(object);
    this.object = this.reactiveObject(object);
  }

  reactiveObject(object, rootProperty) {
    const self = this;
    const objectKeys = Object.keys(object);

    // Loop over all properties of the to-be reactive object
    for (let i = 0; i < objectKeys.length; i++) {
      const key = objectKeys[i];
      const rootProperty = object.rootProperty;
      const currentProperty = key;
      let value = object[key];

      // If property is an array, make it reactive
      if (Array.isArray(value)) {
        value = this.reactiveArray(value, key);
        // if property is an object, make it reactive also
      } else if (isWatchableObject(value) && !protectedNames.includes(key)) {
        // rootProperty should be the current key if first deep object
        value = this.deepReactiveObject(
          value,
          rootProperty || key,
          currentProperty
        );
      }

      // Create an instance of the dependency tracker
      const dep = new Dep(this.global, key, rootProperty, currentProperty);

      // this is used to store the Dep class for the filter output
      if (!rootProperty) this.aliasFilterOutputDep(key, dep);

      Object.defineProperty(object, key, {
        get: function pulseGetter() {
          dep.register();
          return value;
        },
        set: function pulseSetter(newValue) {
          // rootProperty indicates if the object is "deep".
          if (rootProperty && self.mutable.includes(rootProperty)) {
            // mutate locally
            value = newValue;
            // dispatch mutation for rootProperty
            self.dispatch("mutation", {
              collection: self.collection,
              key: rootProperty,
              value: self.object[rootProperty],
              dep: dep
            });
          } else {
            // if backdoor open or is protected name, allow direct mutation
            if (self.allowPrivateWrite || protectedNames.includes(key))
              return (value = newValue);

            // if property is mutable dispatch update
            if (self.mutable.includes(key)) {
              self.dispatch("mutation", {
                collection: self.collection,
                key,
                value: newValue,
                dep: dep
              });
              // we did not apply the mutation since runtime will privatly
              // write the result since we dispatched above
            }
          }
        }
      });
    }
    return object;
  }

  deepReactiveObject(value, rootProperty, propertyOnObject) {
    let objectWithCustomPrototype = Object.create({
      rootProperty,
      propertyOnObject
    });
    // repopulate custom object with incoming values
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i++) {
      const property = keys[i];
      objectWithCustomPrototype[property] = value[property];
    }

    this.allowPrivateWrite = true;
    const obj = this.reactiveObject(objectWithCustomPrototype, rootProperty);
    this.allowPrivateWrite = false;
    return obj;
  }

  reactiveArray(array, key) {
    const self = this;
    const reactiveArray = array.slice();

    for (let i = 0; i < arrayFunctions.length; i++) {
      const func = arrayFunctions[i];
      const original = Array.prototype[func];
      Object.defineProperty(reactiveArray, func, {
        value: function() {
          const result = original.apply(this, arguments);
          self.dispatch("mutation", {
            collection: self.collection,
            key,
            value: result
          });
          return result;
        }
      });
    }
    return reactiveArray;
  }

  privateWrite(property, value) {
    this.allowPrivateWrite = true;
    this.object[property] = value;
    this.allowPrivateWrite = false;
  }

  aliasFilterOutputDep(key, dep) {
    if (this.config.keys && this.config.keys.filters.includes(key)) {
      this.config.referenceFilterDeps(key, dep);
    }
  }
}

// look for filter output access to determine dependencies
// remove filter categories from public object on default config
