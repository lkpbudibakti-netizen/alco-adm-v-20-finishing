declare const __APP_BUILD_SHA__: string;
declare const __APP_BUILD_ID__: string;
declare const __APP_BUILD_DIRTY__: boolean;

export const APP_BUILD_SHA = typeof __APP_BUILD_SHA__ === 'string' ? __APP_BUILD_SHA__ : null;
export const APP_BUILD_ID = typeof __APP_BUILD_ID__ === 'string' ? __APP_BUILD_ID__ : 'runtime-unknown';
export const APP_BUILD_DIRTY = typeof __APP_BUILD_DIRTY__ === 'boolean' ? __APP_BUILD_DIRTY__ : null;
