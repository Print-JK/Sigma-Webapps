import { writePsd as writePsdInternal, getWriterBuffer, createWriter, getWriterBufferNoCopy } from './psdWriter';
import { readPsd as readPsdInternal, createReader } from './psdReader';
export * from './abr';
export * from './csh';
export { initializeCanvas } from './helpers';
export * from './psd';
import { fromByteArray } from 'base64-js';
export var byteArrayToBase64 = fromByteArray;
export function readPsd(buffer, options) {
    var reader = 'buffer' in buffer ?
        createReader(buffer.buffer, buffer.byteOffset, buffer.byteLength) :
        createReader(buffer);
    return readPsdInternal(reader, options);
}
export function writePsd(psd, options) {
    var writer = createWriter();
    writePsdInternal(writer, psd, options);
    return getWriterBuffer(writer);
}
export function writePsdUint8Array(psd, options) {
    var writer = createWriter();
    writePsdInternal(writer, psd, options);
    return getWriterBufferNoCopy(writer);
}
export function writePsdBuffer(psd, options) {
    if (typeof Buffer === 'undefined') {
        throw new Error('Buffer not supported on this platform');
    }
    return Buffer.from(writePsdUint8Array(psd, options));
}
//# sourceMappingURL=index.js.map