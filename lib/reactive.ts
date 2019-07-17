import { protectedNames, arrayFunctions, isWatchableObject } from "./helpers";
import Dep from "./dep";
import { Global, Config } from "./interfaces";

interface Obj {
  [key: string]: any;
}

export default class Reactive {
  dispatch: any;
  allowPrivateWrite: boolean = false;
  touching: boolean = false;
  properties: Array<string>;
  object: Obj;
  touched: null | Dep;
  constructor(
    object: Obj = {},
    private global: Global,
    private collection: string,
    private mutable: Array<string>,
    private type: string
  ) {
    this.dispatch = this.global.dispatch;
    this.properties = Object.keys(object);

    this.object = this.reactiveObject(object);
  }

  reactiveObject(object: Obj, rootProperty?: string) {
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

      Object.defineProperty(object, key, {
        get: function pulseGetter() {
          if (self.touching) {
            self.touched = dep;
            return;
          }
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

  getDep(property) {
    this.touching = true;
    const _ = this.object[property]; // eslint-disable-line no-unused-var
    const dep = this.touched;
    this.touching = false;
    return dep;
  }
}

// look for filter output access to determine dependencies
// remove filter categories from public object on default config
