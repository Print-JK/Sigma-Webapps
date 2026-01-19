import { createCanvas } from 'canvas';
import { initializeCanvas } from './index';
import { decodeJpeg } from './jpeg';
function createCanvasFromData(data) {
    var canvas = createCanvas(100, 100);
    try {
        var context_1 = canvas.getContext('2d');
        var imageData = decodeJpeg(data, function (w, h) { return context_1.createImageData(w, h); });
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        context_1.putImageData(imageData, 0, 0);
    }
    catch (e) {
        console.error('JPEG decompression error', e.message);
    }
    return canvas;
}
initializeCanvas(createCanvas, createCanvasFromData);
export function initialize() {
    initializeCanvas(createCanvas, createCanvasFromData);
}
//# sourceMappingURL=initializeCanvas.js.map