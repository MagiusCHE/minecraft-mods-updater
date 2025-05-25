import { ModInfo } from "../loader/base.ts";
import { ModDownloadResult, ModDownloadType, ModProvider } from "./mod_provider.ts";
//import debug from "npm:debug";
//const log = debug('mmu:CourseForge');

const apiEntryPoint = "https://api.curseforge.com/v1";

// https://docs.curseforge.com/rest-api/?http#get-mod-files

// GET https://api.curseforge.com/v1/mods/search?gameId=432&gameVersion=1.21.5&modLoaderType=4&slug=architectury-api

const MinecraftGameId = 432
const commands = {
    searchMods: `${apiEntryPoint}/mods/search?gameId=${MinecraftGameId}&gameVersion=:gameVersion&modLoaderType=:modLoaderType&searchFilter=:searchFilter`,
    getModFile: `${apiEntryPoint}/mods/:modId/files/:fileId`,
    getModFiles: `${apiEntryPoint}/mods/:modId/files?gameVersion=:gameVersion&modLoaderType=:modLoaderType`,
}

enum ModLoaderType {
    Any = 0,
    Forge = 1,
    Cauldron = 2,
    LiteLoader = 3,
    Fabric = 4,
    Quilt = 5,
    NeoForge = 6,
}


export class CourseForge extends ModProvider {
    private getModLoaderTypeFromName(loader: string): ModLoaderType {
        switch (loader) {
            case "forge":
                return ModLoaderType.Forge
            case "fabric":
                return ModLoaderType.Fabric
            case "quilt":
                return ModLoaderType.Quilt
            case "liteloader":
                return ModLoaderType.LiteLoader
            case "cauldron":
                return ModLoaderType.Cauldron
            default:
                return ModLoaderType.Any
        }
    }
    protected override async getModInfoFor(modId: string | number, targetMCVersion: string, loader: string, originalFullPath?: string): Promise<ModDownloadResult> {
        const ret: ModDownloadResult = []
        const modLoaderType = this.getModLoaderTypeFromName(loader);

        const wordToPurify = ["curseforge", "curse", "forge", "mod", "api", "fabric", "quilt", "liteloader", "cauldron"]
        const searchSafeId = typeof modId == "string" ? modId.toLowerCase().split("-").filter(s => wordToPurify.indexOf(s) == -1).join("-") : modId.toString()

        let versions = await this.API_SearchMods(searchSafeId, targetMCVersion, modLoaderType);

        if (!versions || !versions.data?.length) {
            return ret
        }

        let betterDataIndex = versions.data.findIndex((v: any) => v.slug == modId)
        if (betterDataIndex == -1) {
            betterDataIndex = 0
        }

        const files = await this.API_GetModFiles(versions.data[betterDataIndex].id, targetMCVersion, modLoaderType);

        if (!files || !files.data?.length)
            return ret


        const fileVersion = files.data[0]
        if (!fileVersion) {
            return ret;
        }
        const newOne: ModDownloadType = {
            url: fileVersion.downloadUrl as string,
            fileName: fileVersion.fileName as string,
            //originalFullPath: originalFullPath,
            canReuseOriginal: false,
            version: fileVersion.displayName.split("v").pop()?.trim() ?? fileVersion.displayName,
            provider: this.Name
        }
        ret.push(newOne)

        if (!newOne.url?.length) {
            throw new Error(`CourseForge "downloadUrl" is missing for mod \"${modId}/${fileVersion.displayName}\". Cant load \"${fileVersion.fileName}\".`);
        }

        for (const dep of fileVersion.dependencies) {
            if (dep.relationType != 3)
                continue
            const depVersions = await this.getModInfoFor(dep.modId, targetMCVersion, loader);
            depVersions?.forEach(f => ret.push(f))
        }

        return ret
    }

    protected override async APICall(url: string, headers?: Record<string, string>): Promise<any> {
        const ret = await super.APICall(url, headers);
        if (!ret)
            return ret
        if (!ret.pagination)
            return ret
        if (ret.pagination.totalCount > ret.pagination.index + ret.pagination.resultCount) {
            const ret2 = await this.APICall(url.split('&index=')[0] + `&index=${ret.pagination.index + ret.pagination.resultCount}`, headers)
            return {
                data: ret.data.concat(ret2.data),
                pagination: { ...ret2.pagination, resultCount: ret2.pagination.resultCount + ret.pagination.resultCount }
            }
        }
        return ret;
    }

    private async API_SearchMods(slug: string, targetMCVersion: string, modLoaderType: ModLoaderType): Promise<any> {
        return this.APICall(`${commands.searchMods
            .replace(":gameVersion", targetMCVersion)
            .replace(":modLoaderType", (modLoaderType as number).toString())
            .replace(":searchFilter", slug)
            }`, {
            // https://console.curseforge.com/?#/api-keys
            'x-api-key': Deno.env.get("COURSEFORGE_API_KEY")!
        });
    }
    private async API_GetModFiles(modId: string, targetMCVersion: string, modLoaderType: ModLoaderType): Promise<any> {
        return this.APICall(`${commands.getModFiles
            .replace(":gameVersion", targetMCVersion)
            .replace(":modLoaderType", (modLoaderType as number).toString())
            .replace(":modId", modId)
            }`, {
            // https://console.curseforge.com/?#/api-keys
            'x-api-key': Deno.env.get("COURSEFORGE_API_KEY")!
        });
    }
}