import Library from "./library";
import { defineConfig } from "./helpers";
const pulse = new Library({
  config: {},
  collections: {
    lol: {
      filters: {
        fuck({ channels }) {
          return channels.filterOne;
        }
      }
    },

    channels: {
      groups: ["myChannels"],
      routes: {
        getSomething: request =>
          request.get("https://jsonplaceholder.typicode.com/posts")
      },
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
        test({ channels, routes }) {
          routes.getSomething().then(res => {
            console.log(res);
          });
          channels.currentChannel = "FIRST";
          channels.openChannel = "SECOND";
          return true;
        }
      },
      watch: {
        // deepReactive({ channels }) {
        //   channels.currentChannel = "THIRD";
        // }
      },
      filters: {
        filterOne({ channels }) {
          // console.log("Hi, I'm filter One!");
          // console.log(channels.deepReactive)
          return channels.deepReactive.op.cool.luka;
        }
        // filterTwo({ channels }) {
        //   // console.log("Hi, I'm filter Two!");
        //   return channels.filterOne;
        // }
      }
    }
  }
});

pulse.mapData(({ channels, lol }) => {
  return {
    channel: channels.myChannels,
    cool: channels.deepReactive.op.cool.luka,
    ijwefoiewjf: channels.deepReactive.op.cool,
    haha: channels.filterTwo,
    hahaha: lol.thing
  };
});

// const AHAHAA = pulse.mapData({
//   channel: "channels/currentChannel"
// });

// console.log('woreif',AHAHAA);

// pulse.channels.deepReactive.op.cool.luka = false;

// setTimeout(() => {
//   console.log(
//     pulse._private.collections.channels.filterDeps.filterTwo.subscribers[0]
//   );
// });

pulse.channels.openChannel = false;
// pulse.channels.currentChannel = 'FUCK YYEYEYEYEEYYEY';
// pulse.channels.pls.push(1, 3);
pulse.channels.test();

// pulse.channels.deepReactive.op.cool.luka = "YES!!";

const sampleData = [];
for (let i = 0; i < 10; i++) {
  sampleData.push({
    id: Math.random(),
    thing: true,
    jeff: "hahahaha"
  });
}

pulse.channels.collect(sampleData, ["fuuuuuu", "haha"]);

// console.log(sampleData);

console.log(pulse);

console.log("HERE");

// pulse.channels.routes.getSomething().then(res => {
//   console.log(res);
// });

// pulse._private.collections.channels.data.privateWrite("openChannel", false);
// pulse._private.collections.channels.data.dispatch();
