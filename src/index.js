import Pulse from "./pulse";

const pulse = new Pulse({
  config: {
    bindPropertiesToCollectionRoot: true
  },
  collections: {
    channels: {
      groups: ["myChannels"],
      data: {
        openChannel: true,
        currentChannel: 32,
        pls: [1, 2],
        deepReactive: {
          thing: true,
          op: {
            cool: {
              luka: true
            }
          }
        }
      },
      actions: {
        test({ channels }) {
          channels.currentChannel = "FIRST";
          channels.openChannel = "SECOND";
          return true;
        }
      },
      watch: {
        deepReactive({ channels }) {
          channels.currentChannel = "THIRD";
        }
      },
      filters: {
        filterOne({ channels }) {
          console.log("Hi, I'm filter One!");
          return channels.openChannel;
        },
        filterTwo({ channels }) {
          console.log("Hi, I'm filter Two!");
          return channels.filterOne;
        }
      }
    }
  }
});

pulse.channels.openChannel = false;
// pulse.channels.currentChannel = 'FUCK YYEYEYEYEEYYEY';

// pulse._private.collections.channels.data.privateWrite("openChannel", false);
// pulse._private.collections.channels.data.dispatch();

// pulse.channels.pls.push(1, 3);
// pulse.channels.test();

// pulse.channels.deepReactive.op.cool.luka = "YES!!";

console.log(pulse);

// const thing = {
//   thing: { channels: { data: { test: true } } },
//   thing2: ["channels", "data", "test"],
//   thing3: "channels/data/test"
// };

// var expr = "foo";

// // var collection = {
// //   get [expr]() { return 'bar'; }
// // };

// class Reactive {
//   constructor(object) {
//     this.public = this.reactiveObject(object);
//   }

//   reactiveObject(object) {
//     for (let key in object) {
//       let value = object[key];

//       Object.defineProperty(object, key, {
//         get: function pulseGetter() {
//           console.log(`${key} was accessed`);
//           return value;
//         },
//         set: function pulseSetter(newValue) {
//           console.log("setting value from", value, "to", newValue);
//           value = newValue;
//         }
//       });
//     }
//     return object;
//   }
// }

// const reactive = new Reactive({
//   thing: true,
//   haha: "lol"
// });

// // reactive.public.public = false;
// reactive.public.thing = false;

// // console.log(reactive.public); // "bar"

// // ...this.mapData({ channels } => {
// //   return {
// //     thing: channels.stuff
// //   }
// // }, this)
