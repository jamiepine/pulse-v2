import { uuid } from "./helpers";
export default class Action {
  constructor({ collection, _global, undo }, action, actionName) {
    this.actionName = actionName;
    this.collection = collection;
    this.executing = false;
    this.id = uuid();

    this.prepare(action, _global, undo);
  }

  prepare(action, _global, undo) {
    const _this = this;

    this.exec = function() {
      const context = _global.getContext(_this.collection);
      context.undo = function(error) {
        return undo(this.actionName, this.uuid, error);
      };
      _global.runningAction = _this;

      _this.executing = true;

      const result = action.apply(
        null,
        [context].concat(Array.prototype.slice.call(arguments))
      );

      _this.executing = false;
      _global.runningAction = false;

      return result;
    };
  }
}
