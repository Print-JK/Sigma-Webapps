"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeCanvas = exports.createImageData = exports.createCanvasFromData = exports.createCanvas = exports.writeDataZipWithoutPrediction = exports.writeDataRLE = exports.writeDataRaw = exports.decodeBitmap = exports.resetImageData = exports.hasAlpha = exports.clamp = exports.offsetForChannel = exports.Compression = exports.ChannelID = exports.MaskParams = exports.LayerMaskFlags = exports.ColorSpace = exports.createEnum = exports.revMap = exports.largeAdditionalInfoKeys = exports.layerColors = exports.toBlendMode = exports.fromBlendMode = exports.RAW_IMAGE_DATA = exports.MOCK_HANDLERS = void 0;
var base64_js_1 = require("base64-js");
var pako_1 = require("pako");
exports.MOCK_HANDLERS = false;
exports.RAW_IMAGE_DATA = false;
exports.fromBlendMode = {};
exports.toBlendMode = {
    'pass': 'pass through',
    'norm': 'normal',
    'diss': 'dissolve',
    'dark': 'darken',
    'mul ': 'multiply',
    'idiv': 'color burn',
    'lbrn': 'linear burn',
    'dkCl': 'darker color',
    'lite': 'lighten',
    'scrn': 'screen',
    'div ': 'color dodge',
    'lddg': 'linear dodge',
    'lgCl': 'lighter color',
    'over': 'overlay',
    'sLit': 'soft light',
    'hLit': 'hard light',
    'vLit': 'vivid light',
    'lLit': 'linear light',
    'pLit': 'pin light',
    'hMix': 'hard mix',
    'diff': 'difference',
    'smud': 'exclusion',
    'fsub': 'subtract',
    'fdiv': 'divide',
    'hue ': 'hue',
    'sat ': 'saturation',
    'colr': 'color',
    'lum ': 'luminosity',
};
Object.keys(exports.toBlendMode).forEach(function (key) { return exports.fromBlendMode[exports.toBlendMode[key]] = key; });
exports.layerColors = [
    'none', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'gray'
];
exports.largeAdditionalInfoKeys = [
    // from documentation
    'LMsk', 'Lr16', 'Lr32', 'Layr', 'Mt16', 'Mt32', 'Mtrn', 'Alph', 'FMsk', 'lnk2', 'FEid', 'FXid', 'PxSD',
    // from guessing
    'cinf',
];
function revMap(map) {
    var result = {};
    Object.keys(map).forEach(function (key) { return result[map[key]] = key; });
    return result;
}
exports.revMap = revMap;
function createEnum(prefix, def, map) {
    var rev = revMap(map);
    var decode = function (val) {
        var value = val.split('.')[1];
        if (value && !rev[value])
            throw new Error("Unrecognized value for enum: '".concat(val, "'"));
        return rev[value] || def;
    };
    var encode = function (val) {
        if (val && !map[val])
            throw new Error("Invalid value for enum: '".concat(val, "'"));
        return "".concat(prefix, ".").concat(map[val] || map[def]);
    };
    return { decode: decode, encode: encode };
}
exports.createEnum = createEnum;
var ColorSpace;
(function (ColorSpace) {
    ColorSpace[ColorSpace["RGB"] = 0] = "RGB";
    ColorSpace[ColorSpace["HSB"] = 1] = "HSB";
    ColorSpace[ColorSpace["CMYK"] = 2] = "CMYK";
    ColorSpace[ColorSpace["Lab"] = 7] = "Lab";
    ColorSpace[ColorSpace["Grayscale"] = 8] = "Grayscale";
})(ColorSpace = exports.ColorSpace || (exports.ColorSpace = {}));
var LayerMaskFlags;
(function (LayerMaskFlags) {
    LayerMaskFlags[LayerMaskFlags["PositionRelativeToLayer"] = 1] = "PositionRelativeToLayer";
    LayerMaskFlags[LayerMaskFlags["LayerMaskDisabled"] = 2] = "LayerMaskDisabled";
    LayerMaskFlags[LayerMaskFlags["InvertLayerMaskWhenBlending"] = 4] = "InvertLayerMaskWhenBlending";
    LayerMaskFlags[LayerMaskFlags["LayerMaskFromRenderingOtherData"] = 8] = "LayerMaskFromRenderingOtherData";
    LayerMaskFlags[LayerMaskFlags["MaskHasParametersAppliedToIt"] = 16] = "MaskHasParametersAppliedToIt";
})(LayerMaskFlags = exports.LayerMaskFlags || (exports.LayerMaskFlags = {}));
var MaskParams;
(function (MaskParams) {
    MaskParams[MaskParams["UserMaskDensity"] = 1] = "UserMaskDensity";
    MaskParams[MaskParams["UserMaskFeather"] = 2] = "UserMaskFeather";
    MaskParams[MaskParams["VectorMaskDensity"] = 4] = "VectorMaskDensity";
    MaskParams[MaskParams["VectorMaskFeather"] = 8] = "VectorMaskFeather";
})(MaskParams = exports.MaskParams || (exports.MaskParams = {}));
var ChannelID;
(function (ChannelID) {
    ChannelID[ChannelID["Color0"] = 0] = "Color0";
    ChannelID[ChannelID["Color1"] = 1] = "Color1";
    ChannelID[ChannelID["Color2"] = 2] = "Color2";
    ChannelID[ChannelID["Color3"] = 3] = "Color3";
    ChannelID[ChannelID["Transparency"] = -1] = "Transparency";
    ChannelID[ChannelID["UserMask"] = -2] = "UserMask";
    ChannelID[ChannelID["RealUserMask"] = -3] = "RealUserMask";
})(ChannelID = exports.ChannelID || (exports.ChannelID = {}));
var Compression;
(function (Compression) {
    Compression[Compression["RawData"] = 0] = "RawData";
    Compression[Compression["RleCompressed"] = 1] = "RleCompressed";
    Compression[Compression["ZipWithoutPrediction"] = 2] = "ZipWithoutPrediction";
    Compression[Compression["ZipWithPrediction"] = 3] = "ZipWithPrediction";
})(Compression = exports.Compression || (exports.Compression = {}));
function offsetForChannel(channelId, cmyk) {
    switch (channelId) {
        case 0 /* ChannelID.Color0 */: return 0;
        case 1 /* ChannelID.Color1 */: return 1;
        case 2 /* ChannelID.Color2 */: return 2;
        case 3 /* ChannelID.Color3 */: return cmyk ? 3 : channelId + 1;
        case -1 /* ChannelID.Transparency */: return cmyk ? 4 : 3;
        default: return channelId + 1;
    }
}
exports.offsetForChannel = offsetForChannel;
function clamp(value, min, max) {
    return value < min ? min : (value > max ? max : value);
}
exports.clamp = clamp;
function hasAlpha(data) {
    var size = data.width * data.height * 4;
    for (var i = 3; i < size; i += 4) {
        if (data.data[i] !== 255) {
            return true;
        }
    }
    return false;
}
exports.hasAlpha = hasAlpha;
function resetImageData(_a) {
    var data = _a.data;
    var buffer = new Uint32Array(data.buffer);
    var size = buffer.length | 0;
    for (var p = 0; p < size; p = (p + 1) | 0) {
        buffer[p] = 0xff000000;
    }
}
exports.resetImageData = resetImageData;
function decodeBitmap(input, output, width, height) {
    for (var y = 0, p = 0, o = 0; y < height; y++) {
        for (var x = 0; x < width;) {
            var b = input[o++];
            for (var i = 0; i < 8 && x < width; i++, x++) {
                var v = b & 0x80 ? 0 : 255;
                b = b << 1;
                output[p++] = v;
                output[p++] = v;
                output[p++] = v;
                output[p++] = 255;
            }
        }
    }
}
exports.decodeBitmap = decodeBitmap;
function writeDataRaw(data, offset, width, height) {
    if (!width || !height)
        return undefined;
    var array = new Uint8Array(width * height);
    for (var i = 0; i < array.length; i++) {
        array[i] = data.data[i * 4 + offset];
    }
    return array;
}
exports.writeDataRaw = writeDataRaw;
function writeDataRLE(buffer, _a, offsets, large) {
    var data = _a.data, width = _a.width, height = _a.height;
    if (!width || !height)
        return undefined;
    var stride = (4 * width) | 0;
    var ol = 0;
    var o = (offsets.length * (large ? 4 : 2) * height) | 0;
    for (var _i = 0, offsets_1 = offsets; _i < offsets_1.length; _i++) {
        var offset = offsets_1[_i];
        for (var y = 0, p = offset | 0; y < height; y++) {
            var strideStart = (y * stride) | 0;
            var strideEnd = (strideStart + stride) | 0;
            var lastIndex = (strideEnd + offset - 4) | 0;
            var lastIndex2 = (lastIndex - 4) | 0;
            var startOffset = o;
            for (p = (strideStart + offset) | 0; p < strideEnd; p = (p + 4) | 0) {
                if (p < lastIndex2) {
                    var value1 = data[p];
                    p = (p + 4) | 0;
                    var value2 = data[p];
                    p = (p + 4) | 0;
                    var value3 = data[p];
                    if (value1 === value2 && value1 === value3) {
                        var count = 3;
                        while (count < 128 && p < lastIndex && data[(p + 4) | 0] === value1) {
                            count = (count + 1) | 0;
                            p = (p + 4) | 0;
                        }
                        buffer[o++] = 1 - count;
                        buffer[o++] = value1;
                    }
                    else {
                        var countIndex = o;
                        var writeLast = true;
                        var count = 1;
                        buffer[o++] = 0;
                        buffer[o++] = value1;
                        while (p < lastIndex && count < 128) {
                            p = (p + 4) | 0;
                            value1 = value2;
                            value2 = value3;
                            value3 = data[p];
                            if (value1 === value2 && value1 === value3) {
                                p = (p - 12) | 0;
                                writeLast = false;
                                break;
                            }
                            else {
                                count++;
                                buffer[o++] = value1;
                            }
                        }
                        if (writeLast) {
                            if (count < 127) {
                                buffer[o++] = value2;
                                buffer[o++] = value3;
                                count += 2;
                            }
                            else if (count < 128) {
                                buffer[o++] = value2;
                                count++;
                                p = (p - 4) | 0;
                            }
                            else {
                                p = (p - 8) | 0;
                            }
                        }
                        buffer[countIndex] = count - 1;
                    }
                }
                else if (p === lastIndex) {
                    buffer[o++] = 0;
                    buffer[o++] = data[p];
                }
                else { // p === lastIndex2
                    buffer[o++] = 1;
                    buffer[o++] = data[p];
                    p = (p + 4) | 0;
                    buffer[o++] = data[p];
                }
            }
            var length_1 = o - startOffset;
            if (large) {
                buffer[ol++] = (length_1 >> 24) & 0xff;
                buffer[ol++] = (length_1 >> 16) & 0xff;
            }
            buffer[ol++] = (length_1 >> 8) & 0xff;
            buffer[ol++] = length_1 & 0xff;
        }
    }
    return buffer.slice(0, o);
}
exports.writeDataRLE = writeDataRLE;
function writeDataZipWithoutPrediction(_a, offsets) {
    var data = _a.data, width = _a.width, height = _a.height;
    var size = width * height;
    var channel = new Uint8Array(size);
    var buffers = [];
    var totalLength = 0;
    for (var _i = 0, offsets_2 = offsets; _i < offsets_2.length; _i++) {
        var offset = offsets_2[_i];
        for (var i = 0, o = offset; i < size; i++, o += 4) {
            channel[i] = data[o];
        }
        var buffer = (0, pako_1.deflate)(channel);
        buffers.push(buffer);
        totalLength += buffer.byteLength;
    }
    if (buffers.length > 0) {
        var buffer = new Uint8Array(totalLength);
        var offset = 0;
        for (var _b = 0, buffers_1 = buffers; _b < buffers_1.length; _b++) {
            var b = buffers_1[_b];
            buffer.set(b, offset);
            offset += b.byteLength;
        }
        return buffer;
    }
    else {
        return buffers[0];
    }
}
exports.writeDataZipWithoutPrediction = writeDataZipWithoutPrediction;
var createCanvas = function () {
    throw new Error('Canvas not initialized, use initializeCanvas method to set up createCanvas method');
};
exports.createCanvas = createCanvas;
var createCanvasFromData = function () {
    throw new Error('Canvas not initialized, use initializeCanvas method to set up createCanvasFromData method');
};
exports.createCanvasFromData = createCanvasFromData;
var tempCanvas = undefined;
var createImageData = function (width, height) {
    if (!tempCanvas)
        tempCanvas = (0, exports.createCanvas)(1, 1);
    return tempCanvas.getContext('2d').createImageData(width, height);
};
exports.createImageData = createImageData;
if (typeof document !== 'undefined') {
    exports.createCanvas = function (width, height) {
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    };
    exports.createCanvasFromData = function (data) {
        var image = new Image();
        image.src = 'data:image/jpeg;base64,' + (0, base64_js_1.fromByteArray)(data);
        var canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        canvas.getContext('2d').drawImage(image, 0, 0);
        return canvas;
    };
}
function initializeCanvas(createCanvasMethod, createCanvasFromDataMethod, createImageDataMethod) {
    exports.createCanvas = createCanvasMethod;
    exports.createCanvasFromData = createCanvasFromDataMethod || exports.createCanvasFromData;
    exports.createImageData = createImageDataMethod || exports.createImageData;
}
exports.initializeCanvas = initializeCanvas;
//# sourceMappingURL=helpers.js.map