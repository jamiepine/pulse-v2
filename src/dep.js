export default class Dep {
  constructor({ _global }) {
    this.global = _global;
    this.dependents = new Set();
  }

  register() {
    if (this.global.runningFilter) {
      this.dependents.add(this.global.runningFilter);
    }
  }
}
