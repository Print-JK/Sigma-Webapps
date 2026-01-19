import { BlnM, parseAngle, parsePercent, parseUnitsToNumber, readVersionAndDescriptor } from './descriptor';
import { checkSignature, createReader, readBytes, readDataRLE, readInt16, readInt32, readPascalString, readPattern, readSignature, readUint16, readUint32, readUint8, skipBytes } from './psdReader';
var dynamicsControl = ['off', 'fade', 'pen pressure', 'pen tilt', 'stylus wheel', 'initial direction', 'direction', 'initial rotation', 'rotation'];
function parseDynamics(desc) {
    return {
        control: dynamicsControl[desc.bVTy],
        steps: desc.fStp,
        jitter: parsePercent(desc.jitter),
        minimum: parsePercent(desc['Mnm ']),
    };
}
function parseBrushShape(desc) {
    var shape = {
        size: parseUnitsToNumber(desc.Dmtr, 'Pixels'),
        angle: parseAngle(desc.Angl),
        roundness: parsePercent(desc.Rndn),
        spacingOn: desc.Intr,
        spacing: parsePercent(desc.Spcn),
        flipX: desc.flipX,
        flipY: desc.flipY,
    };
    if (desc['Nm  '])
        shape.name = desc['Nm  '];
    if (desc.Hrdn)
        shape.hardness = parsePercent(desc.Hrdn);
    if (desc.sampledData)
        shape.sampledData = desc.sampledData;
    return shape;
}
export function readAbr(buffer, options) {
    var _a, _b, _c, _d;
    if (options === void 0) { options = {}; }
    var reader = createReader(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    var version = readInt16(reader);
    var samples = [];
    var brushes = [];
    var patterns = [];
    if (version === 1 || version === 2) {
        throw new Error("Unsupported ABR version (".concat(version, ")")); // TODO: ...
    }
    else if (version === 6 || version === 7 || version === 9 || version === 10) {
        var minorVersion = readInt16(reader);
        if (minorVersion !== 1 && minorVersion !== 2)
            throw new Error('Unsupported ABR minor version');
        while (reader.offset < reader.view.byteLength) {
            checkSignature(reader, '8BIM');
            var type = readSignature(reader);
            var size = readUint32(reader);
            var end = reader.offset + size;
            switch (type) {
                case 'samp': {
                    while (reader.offset < end) {
                        var brushLength = readUint32(reader);
                        while (brushLength & 3)
                            brushLength++; // pad to 4 byte alignment
                        var brushEnd = reader.offset + brushLength;
                        var id = readPascalString(reader, 1);
                        // v1 - Skip the Int16 bounds rectangle and the unknown Int16.
                        // v2 - Skip the unknown bytes.
                        skipBytes(reader, minorVersion === 1 ? 10 : 264);
                        var y = readInt32(reader);
                        var x = readInt32(reader);
                        var h = readInt32(reader) - y;
                        var w = readInt32(reader) - x;
                        if (w <= 0 || h <= 0)
                            throw new Error('Invalid bounds');
                        var depth = readInt16(reader);
                        var compression = readUint8(reader); // 0 - raw, 1 - RLE
                        var alpha = new Uint8Array(w * h);
                        if (depth === 8) {
                            if (compression === 0) {
                                alpha.set(readBytes(reader, alpha.byteLength));
                            }
                            else if (compression === 1) {
                                readDataRLE(reader, { width: w, height: h, data: alpha }, w, h, 1, [0], false);
                            }
                            else {
                                throw new Error('Invalid compression');
                            }
                        }
                        else if (depth === 16) {
                            if (compression === 0) {
                                for (var i = 0; i < alpha.byteLength; i++) {
                                    alpha[i] = readUint16(reader) >> 8; // convert to 8bit values
                                }
                            }
                            else if (compression === 1) {
                                throw new Error('not implemented (16bit RLE)'); // TODO: ...
                            }
                            else {
                                throw new Error('Invalid compression');
                            }
                        }
                        else {
                            throw new Error('Invalid depth');
                        }
                        samples.push({ id: id, bounds: { x: x, y: y, w: w, h: h }, alpha: alpha });
                        reader.offset = brushEnd;
                    }
                    break;
                }
                case 'desc': {
                    var desc = readVersionAndDescriptor(reader);
                    // console.log(require('util').inspect(desc, false, 99, true));
                    for (var _i = 0, _e = desc.Brsh; _i < _e.length; _i++) {
                        var brush = _e[_i];
                        var b = {
                            name: brush['Nm  '],
                            shape: parseBrushShape(brush.Brsh),
                            spacing: parsePercent(brush.Spcn),
                            // TODO: brushGroup ???
                            wetEdges: brush.Wtdg,
                            noise: brush.Nose,
                            // TODO: TxtC ??? smoothing / build-up ?
                            // TODO: 'Rpt ' ???
                            useBrushSize: brush.useBrushSize, // ???
                        };
                        if (brush.interpretation != null)
                            b.interpretation = brush.interpretation;
                        if (brush.protectTexture != null)
                            b.protectTexture = brush.protectTexture;
                        if (brush.useTipDynamics) {
                            b.shapeDynamics = {
                                tiltScale: parsePercent(brush.tiltScale),
                                sizeDynamics: parseDynamics(brush.szVr),
                                angleDynamics: parseDynamics(brush.angleDynamics),
                                roundnessDynamics: parseDynamics(brush.roundnessDynamics),
                                flipX: brush.flipX,
                                flipY: brush.flipY,
                                brushProjection: brush.brushProjection,
                                minimumDiameter: parsePercent(brush.minimumDiameter),
                                minimumRoundness: parsePercent(brush.minimumRoundness),
                            };
                        }
                        if (brush.useScatter) {
                            b.scatter = {
                                count: brush['Cnt '],
                                bothAxes: brush.bothAxes,
                                countDynamics: parseDynamics(brush.countDynamics),
                                scatterDynamics: parseDynamics(brush.scatterDynamics),
                            };
                        }
                        if (brush.useTexture && brush.Txtr) {
                            b.texture = {
                                id: brush.Txtr.Idnt,
                                name: brush.Txtr['Nm  '],
                                blendMode: BlnM.decode(brush.textureBlendMode),
                                depth: parsePercent(brush.textureDepth),
                                depthMinimum: parsePercent(brush.minimumDepth),
                                depthDynamics: parseDynamics(brush.textureDepthDynamics),
                                scale: parsePercent(brush.textureScale),
                                invert: brush.InvT,
                                brightness: brush.textureBrightness,
                                contrast: brush.textureContrast,
                            };
                        }
                        var db = brush.dualBrush;
                        if (db && db.useDualBrush) {
                            b.dualBrush = {
                                flip: db.Flip,
                                shape: parseBrushShape(db.Brsh),
                                blendMode: BlnM.decode(db.BlnM),
                                useScatter: db.useScatter,
                                spacing: parsePercent(db.Spcn),
                                count: db['Cnt '],
                                bothAxes: db.bothAxes,
                                countDynamics: parseDynamics(db.countDynamics),
                                scatterDynamics: parseDynamics(db.scatterDynamics),
                            };
                        }
                        if (brush.useColorDynamics) {
                            b.colorDynamics = {
                                foregroundBackground: parseDynamics(brush.clVr),
                                hue: parsePercent(brush['H   ']),
                                saturation: parsePercent(brush.Strt),
                                brightness: parsePercent(brush.Brgh),
                                purity: parsePercent(brush.purity),
                                perTip: brush.colorDynamicsPerTip,
                            };
                        }
                        if (brush.usePaintDynamics) {
                            b.transfer = {
                                flowDynamics: parseDynamics(brush.prVr),
                                opacityDynamics: parseDynamics(brush.opVr),
                                wetnessDynamics: parseDynamics(brush.wtVr),
                                mixDynamics: parseDynamics(brush.mxVr),
                            };
                        }
                        if (brush.useBrushPose) {
                            b.brushPose = {
                                overrideAngle: brush.overridePoseAngle,
                                overrideTiltX: brush.overridePoseTiltX,
                                overrideTiltY: brush.overridePoseTiltY,
                                overridePressure: brush.overridePosePressure,
                                pressure: parsePercent(brush.brushPosePressure),
                                tiltX: brush.brushPoseTiltX,
                                tiltY: brush.brushPoseTiltY,
                                angle: brush.brushPoseAngle,
                            };
                        }
                        var to = brush.toolOptions;
                        if (to) {
                            b.toolOptions = {
                                brushPreset: to.brushPreset,
                                flow: (_a = to.flow) !== null && _a !== void 0 ? _a : 100,
                                smooth: (_b = to.Smoo) !== null && _b !== void 0 ? _b : 0,
                                mode: BlnM.decode(to['Md  '] || 'BlnM.Nrml'),
                                opacity: (_c = to.Opct) !== null && _c !== void 0 ? _c : 100,
                                smoothing: !!to.smoothing,
                                smoothingValue: to.smoothingValue || 0,
                                smoothingRadiusMode: !!to.smoothingRadiusMode,
                                smoothingCatchup: !!to.smoothingCatchup,
                                smoothingCatchupAtEnd: !!to.smoothingCatchupAtEnd,
                                smoothingZoomCompensation: !!to.smoothingZoomCompensation,
                                pressureSmoothing: !!to.pressureSmoothing,
                                usePressureOverridesSize: !!to.usePressureOverridesSize,
                                usePressureOverridesOpacity: !!to.usePressureOverridesOpacity,
                                useLegacy: !!to.useLegacy,
                            };
                            if (to.prVr) {
                                b.toolOptions.flowDynamics = parseDynamics(to.prVr);
                            }
                            if (to.opVr) {
                                b.toolOptions.opacityDynamics = parseDynamics(to.opVr);
                            }
                            if (to.szVr) {
                                b.toolOptions.sizeDynamics = parseDynamics(to.szVr);
                            }
                        }
                        brushes.push(b);
                    }
                    break;
                }
                case 'patt': {
                    if (reader.offset < end) { // TODO: check multiple patterns
                        patterns.push(readPattern(reader));
                        reader.offset = end;
                    }
                    break;
                }
                case 'phry': {
                    // TODO: what is this ?
                    var desc = readVersionAndDescriptor(reader);
                    if (options.logMissingFeatures) {
                        if ((_d = desc.hierarchy) === null || _d === void 0 ? void 0 : _d.length) {
                            console.log('unhandled phry section', desc);
                        }
                    }
                    break;
                }
                default:
                    throw new Error("Invalid brush type: ".concat(type));
            }
            // align to 4 bytes
            while (size % 4) {
                reader.offset++;
                size++;
            }
        }
    }
    else {
        throw new Error("Unsupported ABR version (".concat(version, ")"));
    }
    return { samples: samples, patterns: patterns, brushes: brushes };
}
//# sourceMappingURL=abr.js.map