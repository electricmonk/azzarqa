import { EventEmitter } from "events";
import { Application, Response } from 'express';
import { headersFieldNamesToLowerCase, headersInputToRawArray, normalizeClientRequestArgs, overrideRequests, restoreOverriddenRequests } from 'nock/lib/common';
import { PassThrough } from 'stream';


function toBuffer(chunk: unknown): Buffer {

  switch (typeof chunk) {
    // string defaulting to html
    case 'string':
      return Buffer.from(chunk);
    case 'boolean':
    case 'number':
    case 'object':
      if (Buffer.isBuffer(chunk)) {
        return chunk;
      } else {
        return Buffer.from(JSON.stringify(chunk));
      }
    default:
      return Buffer.from('');
  }
}

function aFakeRequest(options: any, bodyStream: PassThrough) {
  const expressRequest = {
    ...options,
    headers: headersFieldNamesToLowerCase(options.headers),
    url: options.href,
  };

  Object.assign(expressRequest, bodyStream);
  return expressRequest;
}

function aFakeResponse(connection: EventEmitter) {
  const headers: Record<string, string> = {}
  let _statusCode: number = 200;
  const responseStream = new PassThrough();

  const res = {
    headers,
    setHeader: (key: string, value: string) => headers[key.toLowerCase()] = value,
    getHeader: (key: string) => headers[key],

    outputData: [],
    _onPendingData: (length: number) => { },

    status: (code: number) => {
      _statusCode = code;
      return res;
    },

    set statusCode(code: number) {
      _statusCode = code;
    },

    get statusCode(): number {
      return _statusCode;
    },

    get rawHeaders(): string[] {
      return headersInputToRawArray(headers);

    },

    end: (chunk: Uint8Array | string) => {
      responseStream.write(toBuffer(chunk));
      responseStream.end();
      connection.emit('done');
    },
    on: responseStream.on.bind(responseStream),
    once: responseStream.on.bind(responseStream),
    removeAllListeners: responseStream.removeAllListeners.bind(responseStream),
  };

  return res;
}

export function wireHttpCallsTo(logic: Application) {
  global.setImmediate = jest.useRealTimers as unknown as typeof setImmediate;

  overrideRequests(function (proto: string, overriddenRequest: unknown, rawArgs: unknown[]) {
    let invoked = false;
    try {
      const connection = new EventEmitter();
      const bodyStream = new PassThrough();
      const { options, callback } = normalizeClientRequestArgs(...rawArgs);

      const expressRequest = aFakeRequest(options, bodyStream);
      const expressResponse = aFakeResponse(connection);

      function invokeServer() {
        if (!invoked) {
          invoked = true;
          logic(expressRequest, expressResponse as unknown as Response )
        }
      }

      function respond() {
        callback.bind(overriddenRequest)(expressResponse)
      }

      connection.once('flush', invokeServer);
      connection.once('done', respond);
           
      return {
        on: (event: string, callback: () => any) => { 
        },
        removeAllListeners: () => { },
        getHeader: expressResponse.getHeader,
        setHeader: (key: string, value: string) => expressRequest.headers[key.toLowerCase()] = value,
        destroy: () => { },
        write: (data: any, encoding: BufferEncoding) => {
          bodyStream.write(data, encoding);
        },
        end: () => {
          connection.emit('flush')
          bodyStream.end();
        },
      };

    } catch (err) {
      console.error(err);
    }
  });
}

export function unwireHttpCalls() {
  restoreOverriddenRequests();
}