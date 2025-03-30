import { ModInfo } from "../loader/base.ts";
import debug from "npm:debug";
const log = debug('mmu:ModProvider');


export type ModDownloadType = {
    url: string;
    fileName: string;
    canReuseOriginal: boolean;
    originalFullPath?: string;
    version: string;
    provider: string;
}

export type ModDownloadResult = ModDownloadType[]


const cache = {
    apiCalls: new Map<string, any>(),
}

export class ModProvider {

    public async getModDownloadFor(mod: ModInfo, targetMCVersion: string): Promise<ModDownloadResult | undefined> {
        return await this.getModInfoFor(mod.id, targetMCVersion, mod.loader, mod.filePath);
    }

    public get Name(): string {
        return this.constructor.name;
    }
    protected async getModInfoFor(modId: string, targetMCVersion: string, loader: string, originalFullPath?: string): Promise<ModDownloadResult> {
        throw new Error("Not implemented");
    }

    protected async APICall(url: string, headers?: Record<string, string>): Promise<any> {
        if (cache.apiCalls.has(url)) {
            return cache.apiCalls.get(url);
        }
        const fetchOptions: RequestInit = {
            headers: headers,
        };

        const res = await fetch(url, {
            headers,
        });
        if (!res.ok) {
            //throw new Error(`Failed to fetch url ${url}: ${res.statusText}`);
            return undefined
        }
        const ret = await res.json();
        cache.apiCalls.set(url, ret);
        return ret;
    }
}