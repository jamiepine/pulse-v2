export default class Filter {
  constructor(global, collection, filterName, filterFunction) {
    this.global = global;
    this.collection = collection;
    this.name = filterName;
    this.filterFunction = filterFunction;
  }

  run() {
    this.global.runningFilter = this;

    const output = this.filterFunction(this.global.getContext(this.collection));

    this.global.runningFilter = false;
    return output;
  }
}
