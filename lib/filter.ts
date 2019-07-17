import { Global } from "./interfaces";

export default class Filter {
  constructor(
    private global: Global,
    public collection: string,
    public name: string,
    private filterFunction: (context: object) => any
  ) {}

  public run() {
    this.global.runningFilter = this;

    const output = this.filterFunction(this.global.getContext(this.collection));

    this.global.runningFilter = false;
    return output;
  }
}
