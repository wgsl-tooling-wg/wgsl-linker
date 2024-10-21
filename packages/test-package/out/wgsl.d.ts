export interface WgslBundle {
    name: string;
    version: string;
    wesl: Record<string, string>
}

export declare const wgsl: WgslBundle;
export default wgsl;
