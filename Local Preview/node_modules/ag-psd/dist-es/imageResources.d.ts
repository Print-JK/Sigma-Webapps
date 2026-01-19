import { ImageResources, ReadOptions } from './psd';
import { PsdReader } from './psdReader';
import { PsdWriter } from './psdWriter';
export interface ResourceHandler {
    key: number;
    has: (target: ImageResources) => boolean | number;
    read: (reader: PsdReader, target: ImageResources, left: () => number, options: ReadOptions) => void;
    write: (writer: PsdWriter, target: ImageResources, index: number) => void;
}
export declare const resourceHandlers: ResourceHandler[];
export declare const resourceHandlersMap: {
    [key: number]: ResourceHandler;
};
