const WritableConsumableStream = require('writable-consumable-stream');
const DemuxedConsumableStream = require('./demuxed-consumable-stream');

class StreamDemux {
  constructor() {
    this._mainStream = new WritableConsumableStream();
  }

  write(streamName, value) {
    this._mainStream.write({
      streamName,
      data: {
        value,
        done: false
      }
    });
  }

  close(streamName, value) {
    this._mainStream.write({
      streamName, // TODO 2
      data: {
        value,
        done: true
      }
    });
  }

  closeAll(value) {
    this._mainStream.close(value);
  }

  writeToConsumer(consumerId, value) {
    this._mainStream.writeToConsumer(consumerId, {
      consumerId, // TODO 2
      data: {
        value,
        done: false
      }
    });
  }

  closeConsumer(consumerId, value) {
    this._mainStream.closeConsumer(consumerId, {
      consumerId,
      data: {
        value,
        done: true
      }
    });
  }

  getConsumerStats(consumerId) {
    return this._mainStream.getConsumerStats(consumerId);
  }

  getConsumerStatsList(streamName) {
    let consumerList = this._mainStream.getConsumerStatsList();
    return consumerList.filter((consumerStats) => {
      return consumerStats.streamName === streamName;
    });
  }

  getConsumerStatsListAll() {
    return this._mainStream.getConsumerStatsList();
  }

  kill(streamName, value) {
    let consumerList = this.getConsumerStatsList(streamName);
    let len = consumerList.length;
    for (let i = 0; i < len; i++) {
      this.killConsumer(consumerList[i].id, value);
    }
  }

  killAll(value) {
    this._mainStream.kill(value);
  }

  killConsumer(consumerId, value) {
    this._mainStream.killConsumer(consumerId, value);
  }

  getBackpressure(streamName) {
    let consumerList = this.getConsumerStatsList(streamName);
    let len = consumerList.length;

    let maxBackpressure = 0;
    for (let i = 0; i < len; i++) {
      let consumer = consumerList[i];
      if (consumer.backpressure > maxBackpressure) {
        maxBackpressure = consumer.backpressure;
      }
    }
    return maxBackpressure;
  }

  getConsumerBackpressure(consumerId) {
    this._mainStream.getConsumerBackpressure(consumerId);
  }

  hasConsumer(streamName, consumerId) {
    this._mainStream.hasConsumer(consumerId); // TODO 2
  }

  hasConsumerAll(consumerId) {
    this._mainStream.hasConsumer(consumerId);
  }

  createConsumer(streamName, timeout) {
    let mainStreamConsumer = this._mainStream.createConsumer(timeout);

    let consumerNext = mainStreamConsumer.next;
    mainStreamConsumer.next = async function () {
      while (true) {
        let packet = await consumerNext.apply(this, arguments);
        if (packet.value) {
          if (
            packet.value.streamName === streamName ||
            packet.value.consumerId === this.id
          ) {
            return packet.value.data;
          }
        }
        if (packet.done) {
          return packet;
        }
      }
    };

    let consumerGetStats = mainStreamConsumer.getStats;
    mainStreamConsumer.getStats = function () {
      let stats = consumerGetStats.apply(this, arguments);
      stats.streamName = streamName;
      return stats;
    };

    let consumerApplyBackpressure = mainStreamConsumer.applyBackpressure;
    mainStreamConsumer.applyBackpressure = function (packet) {
      if (packet.value) {
        if (
          packet.value.streamName === streamName ||
          packet.value.consumerId === this.id
        ) {
          consumerApplyBackpressure.apply(this, arguments);

          return;
        }
      }
      if (packet.done) {
        consumerApplyBackpressure.apply(this, arguments);
      }
    };

    let consumerReleaseBackpressure = mainStreamConsumer.applyBackpressure;
    mainStreamConsumer.releaseBackpressure = function (packet) {
      if (packet.value) {
        if (
          packet.value.streamName === streamName ||
          packet.value.consumerId === this.id
        ) {
          consumerReleaseBackpressure.apply(this, arguments);

          return;
        }
      }
      if (packet.done) {
        consumerReleaseBackpressure.apply(this, arguments);
      }
    };

    return mainStreamConsumer;
  }

  stream(streamName) {
    return new DemuxedConsumableStream(this, streamName);
  }
}

module.exports = StreamDemux;
