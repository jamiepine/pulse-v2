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
          return channels.currentChannel;
        }
      }
    }
  }
});

pulse.channels.openChannel = false;
// pulse.channels.currentChannel = 'FUCK YYEYEYEYEEYYEY';
pulse.channels.pls.push(1, 3);
// pulse.channels.test();

// pulse.channels.deepReactive.op.cool.luka = "YES!!";

console.log(pulse);

// pulse._private.collections.channels.data.privateWrite("openChannel", false);
// pulse._private.collections.channels.data.dispatch();
