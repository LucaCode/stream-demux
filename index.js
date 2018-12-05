const AsyncIterableStream = require('async-iterable-stream');
const WritableAsyncIterableStream = require('writable-async-iterable-stream');
const END_SYMBOL = Symbol('end');

class StreamDemux {
  constructor() {
    this._mainStream = new WritableAsyncIterableStream();
  }

  _write(name, value, done) {
    this._mainStream.write({
      name,
      data: {value, done}
    });
  }

  write(name, value) {
    this._write(name, value, false)
  }

  end(name) {
    this._write(name, undefined, true)
  }

  endAll() {
    this._mainStream.end();
  }

  async next(name) {
    let packet;
    for await (packet of this._mainStream) {
      if (packet.name === name) {
        break;
      }
    }
    return packet.data;
  }

  async *createStream(name) {
    for await (let packet of this._mainStream) {
      if (packet.name === name) {
        if (packet.data.done) {
          return;
        }
        yield packet.data.value;
      }
    }
  }

  stream(name) {
    return new DemuxedAsyncIterableStream(this, name);
  }
}

class DemuxedAsyncIterableStream extends AsyncIterableStream {
  constructor(streamDemux, name) {
    super();
    this.name = name;
    this._streamDemux = streamDemux;
  }

  next() {
    return this._streamDemux.next(this.name);
  }

  createStream() {
    return this._streamDemux.createStream(this.name);
  }
}

module.exports = StreamDemux;
